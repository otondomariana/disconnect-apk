import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CATEGORY_CONFIG, CategoryKey, normalizeCategoryKey } from '@/constants/categories';
import { formatLongDate, formatTime, fromFirestoreDate, getLogicalDateParts } from '@/lib/date';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/stores/auth';

const PRIMARY = '#039EA2';

const MONTHS_ES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const DAYS_ES = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'];

type SessionItem = {
    id: string;
    challengeId: string;
    challengeTitle: string;
    challengeInstructions: string;
    challengeCategory?: CategoryKey;
    finishedAt?: Date;
};
type ChallengeOption = { id: string; title: string; category?: CategoryKey };

// Extrae el día lógico en Argentina (UTC-3) de un timestamp de Firestore
const getLogicalDay = (d: Date): Date => {
    const { year, month, day } = getLogicalDateParts(d);
    return new Date(year, month, day); // solo partes de fecha, para comparar día a día
};
const fmt = (d: Date | null) => d
    ? `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`
    : '—';

// ─── Micro calendario ────────────────────────────────────────────────────────
function MiniCalendar({
    value, onSelect, minDate, maxDate,
}: { value: Date | null; onSelect: (d: Date) => void; minDate?: Date | null; maxDate?: Date | null }) {
    const today = new Date();
    const [viewYear, setViewYear] = useState(value?.getFullYear() ?? today.getFullYear());
    const [viewMonth, setViewMonth] = useState(value?.getMonth() ?? today.getMonth());

    const firstDay = new Date(viewYear, viewMonth, 1).getDay(); // 0=Sun
    const offset = (firstDay + 6) % 7; // ajuste para semana Mon-Sun
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

    const prevMonth = () => {
        if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
        else setViewMonth(m => m - 1);
    };
    const nextMonth = () => {
        if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
        else setViewMonth(m => m + 1);
    };

    const isDisabled = (day: number) => {
        const d = new Date(viewYear, viewMonth, day);
        if (minDate) {
            const min = new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate());
            if (d < min) return true;
        }
        if (maxDate) {
            const max = new Date(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate());
            if (d > max) return true;
        }
        return false;
    };
    const isSelected = (day: number) => {
        if (!value) return false;
        return value.getFullYear() === viewYear && value.getMonth() === viewMonth && value.getDate() === day;
    };

    const cells: (number | null)[] = [
        ...Array(offset).fill(null),
        ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ];
    // Pad to full rows
    while (cells.length % 7 !== 0) cells.push(null);

    return (
        <View style={cal.wrap}>
            {/* Navegación mes/año */}
            <View style={cal.nav}>
                <Pressable onPress={prevMonth} style={cal.navBtn}><Ionicons name="chevron-back" size={18} color="#282828" /></Pressable>
                <Text style={cal.navTitle}>{MONTHS_ES[viewMonth]} {viewYear}</Text>
                <Pressable onPress={nextMonth} style={cal.navBtn}><Ionicons name="chevron-forward" size={18} color="#282828" /></Pressable>
            </View>
            {/* Cabecera días */}
            <View style={cal.row}>
                {DAYS_ES.map(d => <Text key={d} style={cal.dayHeader}>{d}</Text>)}
            </View>
            {/* Celdas */}
            {Array.from({ length: cells.length / 7 }, (_, r) => (
                <View key={r} style={cal.row}>
                    {cells.slice(r * 7, r * 7 + 7).map((day, c) => {
                        if (!day) return <View key={c} style={cal.cell} />;
                        const disabled = isDisabled(day);
                        const selected = isSelected(day);
                        return (
                            <Pressable
                                key={c}
                                style={[cal.cell, selected && cal.cellSelected, disabled && cal.cellDisabled]}
                                onPress={() => !disabled && onSelect(new Date(viewYear, viewMonth, day))}
                            >
                                <Text style={[cal.dayText, selected && cal.dayTextSelected, disabled && cal.dayTextDisabled]}>
                                    {day}
                                </Text>
                            </Pressable>
                        );
                    })}
                </View>
            ))}
        </View>
    );
}
// ─────────────────────────────────────────────────────────────────────────────

export default function CompletedChallengesScreen() {
    const router = useRouter();
    const user = useAuthStore((s) => s.user);

    const [sessions, setSessions] = useState<SessionItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // ── Filtro de rango de fechas ──────────────────────────────────────────
    const [showDateModal, setShowDateModal] = useState(false);
    const [pendingFrom, setPendingFrom] = useState<Date | null>(null);
    const [pendingTo, setPendingTo] = useState<Date | null>(null);
    const [activeFrom, setActiveFrom] = useState<Date | null>(null);
    const [activeTo, setActiveTo] = useState<Date | null>(null);
    const [dateStep, setDateStep] = useState<'from' | 'to'>('from'); // qué calendario mostrar

    const openDateModal = () => {
        setPendingFrom(activeFrom);
        setPendingTo(activeTo);
        setDateStep('from');
        setShowDateModal(true);
    };
    const applyDateFilter = () => {
        // Guardar sólo partes de fecha (sin hora) para comparar contra el día lógico ART
        setActiveFrom(pendingFrom ? new Date(pendingFrom.getFullYear(), pendingFrom.getMonth(), pendingFrom.getDate()) : null);
        setActiveTo(pendingTo ? new Date(pendingTo.getFullYear(), pendingTo.getMonth(), pendingTo.getDate()) : null);
        setShowDateModal(false);
    };
    const clearDateFilter = () => {
        setPendingFrom(null); setPendingTo(null);
        setActiveFrom(null); setActiveTo(null);
        setShowDateModal(false);
    };

    // ── Filtro de desafío ──────────────────────────────────────────────────
    const [selectedChallenge, setSelectedChallenge] = useState<ChallengeOption | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<CategoryKey | null>(null);
    const [showChallengeModal, setShowChallengeModal] = useState(false);
    const [search, setSearch] = useState('');

    const challengeOptions = useMemo<ChallengeOption[]>(() => {
        const seen = new Map<string, ChallengeOption>();
        sessions.forEach((s) => {
            if (!seen.has(s.challengeId))
                seen.set(s.challengeId, { id: s.challengeId, title: s.challengeTitle, category: s.challengeCategory });
        });
        return Array.from(seen.values()).sort((a, b) => a.title.localeCompare(b.title));
    }, [sessions]);

    const availableCategories = useMemo(() => {
        const keys = new Set<CategoryKey>();
        challengeOptions.forEach((c) => { if (c.category) keys.add(c.category); });
        return Array.from(keys).map((k) => CATEGORY_CONFIG[k]).filter(Boolean);
    }, [challengeOptions]);

    const filteredForModal = useMemo(() => {
        const pool = selectedCategory ? challengeOptions.filter((c) => c.category === selectedCategory) : challengeOptions;
        if (!search.trim()) return pool;
        return pool.filter((c) => c.title.toLowerCase().includes(search.toLowerCase()));
    }, [challengeOptions, selectedCategory, search]);

    // ── Resultados visibles: usa día lógico Argentina para comparar fechas ────
    const visible = useMemo(() => sessions.filter((s) => {
        if (s.finishedAt && (activeFrom || activeTo)) {
            const logicalDay = getLogicalDay(s.finishedAt);
            if (activeFrom && logicalDay < activeFrom) return false;
            if (activeTo && logicalDay > activeTo) return false;
        } else if (!s.finishedAt && (activeFrom || activeTo)) {
            return false;
        }
        if (selectedCategory && s.challengeCategory !== selectedCategory) return false;
        if (selectedChallenge && s.challengeId !== selectedChallenge.id) return false;
        return true;
    }), [sessions, activeFrom, activeTo, selectedCategory, selectedChallenge]);

    const hasDateFilter = activeFrom !== null || activeTo !== null;
    const hasChallengeFilter = selectedCategory !== null || selectedChallenge !== null;
    const hasFilters = hasDateFilter || hasChallengeFilter;

    // ── Carga de datos ─────────────────────────────────────────────────────
    useEffect(() => {
        let active = true;
        const load = async () => {
            if (!user?.uid) { if (active) setLoading(false); return; }
            try {
                const snap = await getDocs(query(collection(db, 'challengeSessions'), where('userId', '==', user.uid)));
                const raw: SessionItem[] = [];
                snap.forEach((docSnap) => {
                    const data = docSnap.data() as { challengeId?: string; finishedAt?: unknown; completed?: boolean };
                    if (data.completed === false) return;
                    const finished = fromFirestoreDate(data.finishedAt);
                    if (!finished || !data.challengeId) return;
                    raw.push({ id: docSnap.id, challengeId: data.challengeId, challengeTitle: '', challengeInstructions: '', finishedAt: finished });
                });
                raw.sort((a, b) => (b.finishedAt?.getTime() ?? 0) - (a.finishedAt?.getTime() ?? 0));

                const cache = new Map<string, { title: string; instructions: string; category?: CategoryKey }>();
                const withDetails: SessionItem[] = [];
                for (const item of raw) {
                    if (!active) break;
                    if (!cache.has(item.challengeId)) {
                        const cSnap = await getDoc(doc(db, 'challenges', item.challengeId));
                        const cData = cSnap.data() as { title?: string; instructions?: string; category?: string } | undefined;
                        cache.set(item.challengeId, {
                            title: cData?.title?.toString() ?? 'Desafío',
                            instructions: cData?.instructions?.toString() ?? '',
                            category: normalizeCategoryKey((cData?.category ?? '').toString()),
                        });
                    }
                    const ch = cache.get(item.challengeId)!;
                    withDetails.push({ ...item, challengeTitle: ch.title, challengeInstructions: ch.instructions, challengeCategory: ch.category });
                }
                if (active) {
                    setSessions(withDetails);
                    setError(withDetails.length === 0 ? 'Aún no has completado ningún desafío.' : null);
                }
            } catch (err) {
                console.error('[CompletedChallenges]', err);
                if (active) setError('No pudimos cargar tu historial. Intenta nuevamente.');
            } finally {
                if (active) setLoading(false);
            }
        };
        load();
        return () => { active = false; };
    }, [user?.uid]);

    const handleGoBack = () => router.canGoBack() ? router.back() : router.replace('/(main)/profile');
    const handleSelectSession = (id: string) => router.push({ pathname: '/(main)/logbook/session/[sessionId]', params: { sessionId: id } } as never);

    const handleSelectChallenge = (ch: ChallengeOption) => {
        setSelectedChallenge(ch);
        if (ch.category && selectedCategory !== ch.category) setSelectedCategory(ch.category);
        setShowChallengeModal(false); setSearch('');
    };
    const handleToggleCategory = (key: CategoryKey) => {
        if (selectedCategory === key) { setSelectedCategory(null); setSelectedChallenge(null); }
        else { setSelectedCategory(key); if (selectedChallenge?.category !== key) setSelectedChallenge(null); }
    };
    const clearAllFilters = () => { setActiveFrom(null); setActiveTo(null); setSelectedCategory(null); setSelectedChallenge(null); };

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Pressable style={styles.backButton} onPress={handleGoBack}>
                    <Ionicons name="chevron-back" size={24} color="#282828" />
                </Pressable>
                <Text style={styles.headerTitle}>Desafíos Completados</Text>
                <View style={styles.headerRight} />
            </View>

            {loading ? (
                <View style={styles.centerContent}><ActivityIndicator color={PRIMARY} size="large" /></View>
            ) : (
                <>
                    {/* ── FILTROS ── */}
                    <View style={styles.filtersSection}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow} style={{ maxHeight: 46 }}>
                            {/* Rango de fecha */}
                            <Pressable style={[styles.chip, hasDateFilter && styles.chipActive]} onPress={openDateModal}>
                                <Ionicons name="calendar-outline" size={13} color={hasDateFilter ? '#FFF' : '#4B5A66'} />
                                <Text style={[styles.chipText, hasDateFilter && styles.chipTextActive]}>
                                    {hasDateFilter ? `${fmt(activeFrom)} – ${fmt(activeTo)}` : 'Rango de fecha'}
                                </Text>
                                <Ionicons name="chevron-down" size={12} color={hasDateFilter ? '#FFF' : '#4B5A66'} />
                            </Pressable>
                            {/* Categorías */}
                            {availableCategories.map((cat) => {
                                const active = selectedCategory === cat.key;
                                return (
                                    <Pressable key={cat.key} style={[styles.chip, active && styles.chipActive]} onPress={() => handleToggleCategory(cat.key)}>
                                        <Ionicons name={cat.iconName} size={13} color={active ? '#FFF' : '#4B5A66'} />
                                        <Text style={[styles.chipText, active && styles.chipTextActive]}>{cat.label}</Text>
                                    </Pressable>
                                );
                            })}
                        </ScrollView>

                        <View style={styles.filterRow}>
                            <Pressable style={[styles.challengeFilterBtn, selectedChallenge && styles.challengeFilterBtnActive]} onPress={() => setShowChallengeModal(true)}>
                                <Ionicons name="flash-outline" size={14} color={selectedChallenge ? '#FFF' : '#4B5A66'} />
                                <Text style={[styles.challengeFilterText, selectedChallenge && styles.challengeFilterTextActive]} numberOfLines={1}>
                                    {selectedChallenge ? selectedChallenge.title : 'Filtrar por desafío'}
                                </Text>
                                <Ionicons name="chevron-down" size={14} color={selectedChallenge ? '#FFF' : '#4B5A66'} />
                            </Pressable>
                            {hasFilters && <Pressable style={styles.clearBtn} onPress={clearAllFilters}><Ionicons name="close-circle" size={20} color="#A0A0A0" /></Pressable>}
                        </View>
                    </View>

                    {hasFilters && <Text style={styles.resultCount}>{visible.length} {visible.length === 1 ? 'resultado' : 'resultados'}</Text>}

                    {/* ── LISTA ── */}
                    {visible.length === 0 && !error ? (
                        <View style={styles.emptyContainer}>
                            <Ionicons name="search-outline" size={56} color="#C4C4C4" />
                            <Text style={styles.emptyText}>No hay desafíos con esos filtros.</Text>
                        </View>
                    ) : error && sessions.length === 0 ? (
                        <View style={styles.emptyContainer}>
                            <Ionicons name="flag-outline" size={64} color="#C4C4C4" />
                            <Text style={styles.emptyText}>{error}</Text>
                        </View>
                    ) : (
                        <FlatList
                            data={visible}
                            keyExtractor={(item) => item.id}
                            contentContainerStyle={styles.listContainer}
                            showsVerticalScrollIndicator={false}
                            renderItem={({ item }) => (
                                <Pressable style={({ pressed }) => [styles.card, pressed && styles.cardPressed]} onPress={() => handleSelectSession(item.id)}>
                                    <Text style={styles.cardTitle}>{item.challengeTitle}</Text>
                                    {item.finishedAt && <Text style={styles.cardTime}>{formatLongDate(item.finishedAt)} - {formatTime(item.finishedAt)}</Text>}
                                    <Text style={styles.cardDescription} numberOfLines={3}>{item.challengeInstructions}</Text>
                                    <Text style={styles.cardLink}>Ver detalles</Text>
                                </Pressable>
                            )}
                        />
                    )}
                </>
            )}

            {/* ── MODAL: RANGO DE FECHAS (calendario JS puro) ── */}
            <Modal visible={showDateModal} animationType="slide" transparent onRequestClose={() => setShowDateModal(false)}>
                <Pressable style={styles.modalOverlay} onPress={() => setShowDateModal(false)}>
                    <Pressable style={[styles.modalSheet, { maxHeight: '92%' }]} onPress={() => { }}>
                        <View style={styles.modalHandle} />
                        <Text style={styles.modalTitle}>Rango de fechas</Text>

                        {/* Tabs Desde / Hasta */}
                        <View style={styles.dateTabs}>
                            <Pressable style={[styles.dateTab, dateStep === 'from' && styles.dateTabActive]} onPress={() => setDateStep('from')}>
                                <Text style={[styles.dateTabLabel, dateStep === 'from' && styles.dateTabLabelActive]}>Desde</Text>
                                <Text style={[styles.dateTabValue, dateStep === 'from' && styles.dateTabValueActive]}>
                                    {pendingFrom ? fmt(pendingFrom) : 'Sin definir'}
                                </Text>
                            </Pressable>
                            <View style={styles.dateTabDivider} />
                            <Pressable style={[styles.dateTab, dateStep === 'to' && styles.dateTabActive]} onPress={() => setDateStep('to')}>
                                <Text style={[styles.dateTabLabel, dateStep === 'to' && styles.dateTabLabelActive]}>Hasta</Text>
                                <Text style={[styles.dateTabValue, dateStep === 'to' && styles.dateTabValueActive]}>
                                    {pendingTo ? fmt(pendingTo) : 'Sin definir'}
                                </Text>
                            </Pressable>
                        </View>

                        {/* Calendario */}
                        {dateStep === 'from' ? (
                            <MiniCalendar
                                value={pendingFrom}
                                maxDate={pendingTo ?? new Date()}
                                onSelect={(d) => { setPendingFrom(d); setDateStep('to'); }}
                            />
                        ) : (
                            <MiniCalendar
                                value={pendingTo}
                                minDate={pendingFrom}
                                maxDate={new Date()}
                                onSelect={(d) => setPendingTo(d)}
                            />
                        )}

                        {/* Acciones */}
                        <View style={styles.dateActions}>
                            <Pressable style={styles.clearDateBtn} onPress={clearDateFilter}>
                                <Text style={styles.clearDateText}>Limpiar</Text>
                            </Pressable>
                            <Pressable style={styles.applyBtn} onPress={applyDateFilter}>
                                <Text style={styles.applyText}>Aplicar</Text>
                            </Pressable>
                        </View>
                    </Pressable>
                </Pressable>
            </Modal>

            {/* ── MODAL: BUSCADOR DE DESAFÍOS ── */}
            <Modal visible={showChallengeModal} animationType="slide" transparent onRequestClose={() => { setShowChallengeModal(false); setSearch(''); }}>
                <Pressable style={styles.modalOverlay} onPress={() => { setShowChallengeModal(false); setSearch(''); }}>
                    <Pressable style={styles.modalSheet} onPress={() => { }}>
                        <View style={styles.modalHandle} />
                        <Text style={styles.modalTitle}>Filtrar por desafío</Text>
                        <View style={styles.searchBox}>
                            <Ionicons name="search-outline" size={16} color="#A0A0A0" />
                            <TextInput style={styles.searchInput} value={search} onChangeText={setSearch} placeholder="Buscar desafío..." placeholderTextColor="#A0A0A0" autoFocus returnKeyType="search" />
                            {search.length > 0 && <Pressable onPress={() => setSearch('')}><Ionicons name="close-circle" size={16} color="#A0A0A0" /></Pressable>}
                        </View>
                        <Pressable style={[styles.modalItem, !selectedChallenge && styles.modalItemActive]} onPress={() => { setSelectedChallenge(null); setShowChallengeModal(false); setSearch(''); }}>
                            <Text style={[styles.modalItemText, !selectedChallenge && styles.modalItemTextActive]}>Todos los desafíos</Text>
                            {!selectedChallenge && <Ionicons name="checkmark" size={18} color={PRIMARY} />}
                        </Pressable>
                        <FlatList
                            data={filteredForModal}
                            keyExtractor={(item) => item.id}
                            keyboardShouldPersistTaps="handled"
                            showsVerticalScrollIndicator={false}
                            style={{ maxHeight: 320 }}
                            ListEmptyComponent={<View style={styles.modalEmpty}><Text style={styles.modalEmptyText}>No se encontraron desafíos.</Text></View>}
                            renderItem={({ item }) => {
                                const isActive = selectedChallenge?.id === item.id;
                                const catConfig = item.category ? CATEGORY_CONFIG[item.category] : null;
                                return (
                                    <Pressable style={[styles.modalItem, isActive && styles.modalItemActive]} onPress={() => handleSelectChallenge(item)}>
                                        <View style={{ flex: 1, gap: 2 }}>
                                            <Text style={[styles.modalItemText, isActive && styles.modalItemTextActive]} numberOfLines={2}>{item.title}</Text>
                                            {catConfig && <Text style={styles.modalItemCategory}>{catConfig.label}</Text>}
                                        </View>
                                        {isActive && <Ionicons name="checkmark" size={18} color={PRIMARY} />}
                                    </Pressable>
                                );
                            }}
                        />
                    </Pressable>
                </Pressable>
            </Modal>
        </SafeAreaView>
    );
}

// ── Estilos del calendario ──────────────────────────────────────────────────
const CELL_SIZE = 40;
const cal = StyleSheet.create({
    wrap: { marginTop: 8 },
    nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
    navBtn: { padding: 8 },
    navTitle: { fontSize: 15, fontFamily: 'PlusJakartaSans-Bold', color: '#282828' },
    row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
    dayHeader: { width: CELL_SIZE, textAlign: 'center', fontSize: 12, fontFamily: 'PlusJakartaSans-Medium', color: '#A0A0A0', paddingBottom: 4 },
    cell: { width: CELL_SIZE, height: CELL_SIZE, alignItems: 'center', justifyContent: 'center', borderRadius: CELL_SIZE / 2 },
    cellSelected: { backgroundColor: PRIMARY },
    cellDisabled: { opacity: 0.25 },
    dayText: { fontSize: 14, fontFamily: 'PlusJakartaSans-Regular', color: '#282828' },
    dayTextSelected: { color: '#FFFFFF', fontFamily: 'PlusJakartaSans-Bold' },
    dayTextDisabled: { color: '#C4C4C4' },
});

// ── Estilos de la pantalla ───────────────────────────────────────────────────
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F7FAFA' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 16, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F0F5F5' },
    backButton: { padding: 8, marginLeft: -8 },
    headerTitle: { fontSize: 20, fontFamily: 'PlusJakartaSans-Bold', color: '#282828' },
    headerRight: { width: 40 },
    centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    filtersSection: { backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F0F5F5', paddingBottom: 10, gap: 6 },
    chipsRow: { gap: 8, paddingHorizontal: 16, paddingTop: 8 },
    chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: '#F5FAFA', borderWidth: 1, borderColor: '#E0E5E7' },
    chipActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
    chipText: { fontSize: 12, fontFamily: 'PlusJakartaSans-Medium', color: '#4B5A66' },
    chipTextActive: { color: '#FFFFFF' },
    filterRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingTop: 2 },
    challengeFilterBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, backgroundColor: '#F5FAFA', borderWidth: 1, borderColor: '#E0E5E7' },
    challengeFilterBtnActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
    challengeFilterText: { flex: 1, fontSize: 13, fontFamily: 'PlusJakartaSans-Medium', color: '#4B5A66' },
    challengeFilterTextActive: { color: '#FFFFFF' },
    clearBtn: { padding: 4 },
    resultCount: { fontSize: 13, fontFamily: 'PlusJakartaSans-Regular', color: '#6E6E6E', paddingHorizontal: 24, paddingTop: 10, paddingBottom: 2 },
    listContainer: { padding: 20, paddingBottom: 40, gap: 16 },
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, gap: 16 },
    emptyText: { fontSize: 17, fontFamily: 'PlusJakartaSans-Medium', color: '#6E6E6E', textAlign: 'center', lineHeight: 26 },
    card: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, gap: 8, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
    cardPressed: { opacity: 0.7 },
    cardTitle: { fontSize: 18, fontFamily: 'PlusJakartaSans-Bold', color: '#0F4D4F' },
    cardTime: { fontSize: 14, fontFamily: 'PlusJakartaSans-Medium', color: '#4B5A66' },
    cardDescription: { fontSize: 15, fontFamily: 'PlusJakartaSans-Regular', color: '#1F2933', lineHeight: 22 },
    cardLink: { fontSize: 15, fontFamily: 'PlusJakartaSans-Bold', color: PRIMARY, marginTop: 4 },
    // Modal base
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
    modalSheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 12, paddingBottom: 40, paddingHorizontal: 20 },
    modalHandle: { width: 40, height: 4, backgroundColor: '#E0E5E7', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
    modalTitle: { fontSize: 18, fontFamily: 'PlusJakartaSans-Bold', color: '#282828', marginBottom: 16 },
    // Date tabs
    dateTabs: { flexDirection: 'row', borderWidth: 1, borderColor: '#E0E5E7', borderRadius: 16, overflow: 'hidden', marginBottom: 12 },
    dateTab: { flex: 1, paddingVertical: 10, paddingHorizontal: 12, alignItems: 'center' },
    dateTabActive: { backgroundColor: '#E8F7F7' },
    dateTabDivider: { width: 1, backgroundColor: '#E0E5E7' },
    dateTabLabel: { fontSize: 11, fontFamily: 'PlusJakartaSans-Medium', color: '#A0A0A0', marginBottom: 2 },
    dateTabLabelActive: { color: PRIMARY },
    dateTabValue: { fontSize: 14, fontFamily: 'PlusJakartaSans-Bold', color: '#282828' },
    dateTabValueActive: { color: PRIMARY },
    dateActions: { flexDirection: 'row', gap: 12, marginTop: 20 },
    clearDateBtn: { flex: 1, alignItems: 'center', paddingVertical: 13, borderRadius: 16, borderWidth: 1, borderColor: '#E0E5E7' },
    clearDateText: { fontSize: 16, fontFamily: 'PlusJakartaSans-Medium', color: '#6E6E6E' },
    applyBtn: { flex: 1, alignItems: 'center', paddingVertical: 13, borderRadius: 16, backgroundColor: PRIMARY },
    applyText: { fontSize: 16, fontFamily: 'PlusJakartaSans-Bold', color: '#FFFFFF' },
    // Challenge modal
    searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F5FAFA', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 8, borderWidth: 1, borderColor: '#E0E5E7' },
    searchInput: { flex: 1, fontSize: 15, fontFamily: 'PlusJakartaSans-Regular', color: '#282828', paddingVertical: 0 },
    modalItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: '#F0F5F5', gap: 10 },
    modalItemActive: { backgroundColor: '#F0FAFA', borderRadius: 12, paddingHorizontal: 8 },
    modalItemText: { flex: 1, fontSize: 15, fontFamily: 'PlusJakartaSans-Regular', color: '#282828' },
    modalItemTextActive: { fontFamily: 'PlusJakartaSans-Bold', color: PRIMARY },
    modalItemCategory: { fontSize: 12, fontFamily: 'PlusJakartaSans-Regular', color: '#A0A0A0' },
    modalEmpty: { paddingVertical: 24, alignItems: 'center' },
    modalEmptyText: { fontSize: 15, fontFamily: 'PlusJakartaSans-Regular', color: '#A0A0A0' },
});
