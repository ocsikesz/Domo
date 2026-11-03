import { useColorScheme } from 'react-native';

export function useTheme() {
  const dark = useColorScheme() === 'dark';
  return {
    dark,
    bg: dark ? '#111111' : '#ffffff',
    fg: dark ? '#f2f2f2' : '#1a1a1a',
    muted: dark ? '#9a9a9a' : '#6b6b6b',
    card: dark ? '#1f1f1f' : '#f2f2f2',
    accent: dark ? '#7fb2ff' : '#1f5fd1',
    ok: dark ? '#6fd08c' : '#1f8a43',
    error: dark ? '#ff8a80' : '#c62828',
  };
}

export type Theme = ReturnType<typeof useTheme>;
