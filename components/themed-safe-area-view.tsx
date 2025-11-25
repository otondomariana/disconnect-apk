import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, StyleSheet, type ViewProps } from 'react-native';
import { useThemeColor } from '@/hooks/use-theme-color';

export type ThemedSafeAreaViewProps = ViewProps & {
  lightColor?: string;
  darkColor?: string;
};

export function ThemedSafeAreaView({
  style,
  lightColor,
  darkColor,
  ...otherProps
}: ThemedSafeAreaViewProps) {
  const backgroundColor = useThemeColor({ light: lightColor, dark: darkColor }, 'background');
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor,
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
          paddingLeft: insets.left,
          paddingRight: insets.right,
        },
        style,
      ]}
      {...otherProps}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
