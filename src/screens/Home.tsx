import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { TuyaClient, TuyaDevice } from '../tuya/api';
import { useTheme } from '../theme';

const NOT_CONNECTED = [
  { name: 'TV Samsung', source: 'SmartThings' },
  { name: 'Roborock', source: 'cont Roborock' },
  { name: 'Airfryer Philips', source: 'cont HomeID' },
];

type Props = {
  tuya: TuyaClient | null;
  onConnectTuya: () => void;
  onLogoutTuya: () => void;
};

export default function Home({ tuya, onConnectTuya, onLogoutTuya }: Props) {
  const t = useTheme();
  const [devices, setDevices] = useState<TuyaDevice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!tuya) return;
    setLoading(true);
    setError(null);
    try {
      const homes = await tuya.homes();
      const all: TuyaDevice[] = [];
      for (const h of homes) all.push(...(await tuya.devices(h.id)));
      setDevices(all);
    } catch (e: any) {
      setError(`Tuya: ${e?.message ?? 'eroare necunoscută'}`);
    } finally {
      setLoading(false);
    }
  }, [tuya]);

  useEffect(() => {
    if (tuya) load();
    else setDevices([]);
  }, [tuya, load]);

  return (
    <ScrollView
      style={{ backgroundColor: t.bg }}
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
    >
      <Text style={[styles.title, { color: t.fg }]}>Domo</Text>
      <Text style={[styles.subtitle, { color: t.muted }]}>Aparatele casei, într-un singur loc</Text>

      <View style={styles.sectionRow}>
        <Text style={[styles.section, { color: t.fg }]}>Smart Life (Tuya)</Text>
        {tuya && (
          <Pressable onPress={onLogoutTuya}>
            <Text style={{ color: t.accent }}>Deconectare</Text>
          </Pressable>
        )}
      </View>

      {!tuya ? (
        <Pressable onPress={onConnectTuya} style={[styles.card, { backgroundColor: t.card }]}>
          <Text style={[styles.cardTitle, { color: t.accent }]}>Conectează contul Smart Life</Text>
          <Text style={{ color: t.muted }}>Cameră, litieră și alte aparate Tuya</Text>
        </Pressable>
      ) : loading && devices.length === 0 ? (
        <ActivityIndicator style={{ marginVertical: 16 }} color={t.accent} />
      ) : devices.length === 0 && !error ? (
        <View style={[styles.card, { backgroundColor: t.card }]}>
          <Text style={{ color: t.muted }}>
            Contul e conectat, dar nu are aparate. Adaugă camera și litiera în Smart Life, apoi trage în jos pentru
            reîmprospătare.
          </Text>
        </View>
      ) : (
        devices.map((d) => (
          <Pressable
            key={d.id}
            onPress={() => setExpanded(expanded === d.id ? null : d.id)}
            style={[styles.card, { backgroundColor: t.card }]}
          >
            <View style={styles.row}>
              <Text style={[styles.cardTitle, { color: t.fg, flex: 1 }]}>{d.name}</Text>
              <Text style={{ color: d.online ? t.ok : t.muted }}>{d.online ? '● online' : '○ offline'}</Text>
            </View>
            <Text style={{ color: t.muted }}>
              {d.product_name} · {d.category}
            </Text>
            {expanded === d.id && (
              <View style={{ marginTop: 8 }}>
                {Object.entries(d.status).map(([k, v]) => (
                  <Text key={k} style={[styles.mono, { color: t.muted }]}>
                    {k}: {JSON.stringify(v)}
                  </Text>
                ))}
              </View>
            )}
          </Pressable>
        ))
      )}

      {error && <Text style={{ color: t.error, marginBottom: 12 }}>{error}</Text>}

      <Text style={[styles.section, { color: t.fg, marginTop: 16 }]}>În curând</Text>
      {NOT_CONNECTED.map((d) => (
        <View key={d.name} style={[styles.card, { backgroundColor: t.card }]}>
          <Text style={[styles.cardTitle, { color: t.fg }]}>{d.name}</Text>
          <Text style={{ color: t.muted }}>{d.source} · neconectat</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, paddingTop: 72, paddingBottom: 40 },
  title: { fontSize: 32, fontWeight: '700' },
  subtitle: { fontSize: 15, marginTop: 4, marginBottom: 24 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  section: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  card: { borderRadius: 12, padding: 16, marginBottom: 10 },
  cardTitle: { fontSize: 16, fontWeight: '600', marginBottom: 2 },
  row: { flexDirection: 'row', alignItems: 'center' },
  mono: { fontFamily: 'monospace', fontSize: 12 },
});
