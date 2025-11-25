import { Stack } from 'expo-router';

export default function LogbookStackLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[date]" />
      <Stack.Screen name="session/[sessionId]" />
      <Stack.Screen name="reflection/[reflectionId]" />
    </Stack>
  );
}
