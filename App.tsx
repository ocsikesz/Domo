import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import Home from './src/screens/Home';
import TuyaLogin from './src/screens/TuyaLogin';
import { clearSession, loadSession, TuyaClient } from './src/tuya/api';
import { useTheme } from './src/theme';

export default function App() {
  const t = useTheme();
  const [ready, setReady] = useState(false);
  const [tuya, setTuya] = useState<TuyaClient | null>(null);
  const [screen, setScreen] = useState<'home' | 'tuyaLogin'>('home');

  useEffect(() => {
    loadSession()
      .then((s) => s && setTuya(new TuyaClient(s)))
      .finally(() => setReady(true));
  }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: t.bg }}>
        <ActivityIndicator color={t.accent} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      {screen === 'tuyaLogin' ? (
        <TuyaLogin
          onDone={(s) => {
            setTuya(new TuyaClient(s));
            setScreen('home');
          }}
          onCancel={() => setScreen('home')}
        />
      ) : (
        <Home
          tuya={tuya}
          onConnectTuya={() => setScreen('tuyaLogin')}
          onLogoutTuya={async () => {
            try {
              await tuya?.logout();
            } catch {
              await clearSession();
            }
            setTuya(null);
          }}
        />
      )}
      <StatusBar style="auto" />
    </View>
  );
}
