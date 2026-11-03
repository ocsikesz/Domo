import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import Home from './src/screens/Home';
import RoborockLogin from './src/screens/RoborockLogin';
import TuyaLogin from './src/screens/TuyaLogin';
import {
  clearSession as clearRoborock,
  loadSession as loadRoborock,
  RoborockClient,
} from './src/roborock/api';
import { clearSession as clearTuya, loadSession as loadTuya, TuyaClient } from './src/tuya/api';
import { useTheme } from './src/theme';

type Screen = 'home' | 'tuyaLogin' | 'roborockLogin';

export default function App() {
  const t = useTheme();
  const [ready, setReady] = useState(false);
  const [tuya, setTuya] = useState<TuyaClient | null>(null);
  const [roborock, setRoborock] = useState<RoborockClient | null>(null);
  const [screen, setScreen] = useState<Screen>('home');

  useEffect(() => {
    Promise.all([
      loadTuya().then((s) => s && setTuya(new TuyaClient(s))),
      loadRoborock().then((s) => s && setRoborock(new RoborockClient(s))),
    ]).finally(() => setReady(true));
  }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: t.bg }}>
        <ActivityIndicator color={t.accent} />
      </View>
    );
  }

  if (screen === 'tuyaLogin') {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg }}>
        <TuyaLogin
          onDone={(s) => {
            setTuya(new TuyaClient(s));
            setScreen('home');
          }}
          onCancel={() => setScreen('home')}
        />
        <StatusBar style="auto" />
      </View>
    );
  }

  if (screen === 'roborockLogin') {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg }}>
        <RoborockLogin
          onDone={(s) => {
            setRoborock(new RoborockClient(s));
            setScreen('home');
          }}
          onCancel={() => setScreen('home')}
        />
        <StatusBar style="auto" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Home
        tuya={tuya}
        roborock={roborock}
        onConnectTuya={() => setScreen('tuyaLogin')}
        onLogoutTuya={async () => {
          try {
            await tuya?.logout();
          } catch {
            await clearTuya();
          }
          setTuya(null);
        }}
        onConnectRoborock={() => setScreen('roborockLogin')}
        onLogoutRoborock={async () => {
          await clearRoborock();
          setRoborock(null);
        }}
      />
      <StatusBar style="auto" />
    </View>
  );
}
