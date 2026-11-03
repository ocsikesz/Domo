import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { RoborockClient, RoborockDevice } from '../roborock/api';
import { StClient, StDevice } from '../smartthings/api';
import { TuyaClient, TuyaDevice } from '../tuya/api';
import { useTheme } from '../theme';

const NOT_CONNECTED = [{ name: 'Airfryer Philips', source: 'cont HomeID' }];

type Props = {
  tuya: TuyaClient | null;
  roborock: RoborockClient | null;
  smartthings: StClient | null;
  onConnectTuya: () => void;
  onLogoutTuya: () => void;
  onConnectRoborock: () => void;
  onLogoutRoborock: () => void;
  onConnectSt: () => void;
  onLogoutSt: () => void;
};

export default function Home({
  tuya,
  roborock,
  smartthings,
  onConnectTuya,
  onLogoutTuya,
  onConnectRoborock,
  onLogoutRoborock,
  onConnectSt,
  onLogoutSt,
}: Props) {
  const t = useTheme();
  const [devices, setDevices] = useState<TuyaDevice[]>([]);
  const [robots, setRobots] = useState<RoborockDevice[]>([]);
  const [tvs, setTvs] = useState<StDevice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rrError, setRrError] = useState<string | null>(null);
  const [stError, setStError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    if (tuya) {
      setError(null);
      try {
        const homes = await tuya.homes();
        const all: TuyaDevice[] = [];
        for (const h of homes) all.push(...(await tuya.devices(h.id)));
        setDevices(all);
      } catch (e: any) {
        setError(`Tuya: ${e?.message ?? 'eroare necunoscută'}`);
      }
    } else setDevices([]);

    if (roborock) {
      setRrError(null);
      try {
        setRobots(await roborock.devices());
      } catch (e: any) {
        setRrError(`Roborock: ${e?.message ?? 'eroare necunoscută'}`);
      }
    } else setRobots([]);

    if (smartthings) {
      setStError(null);
      try {
        setTvs((await smartthings.devices()).filter((d) => d.isTv || d.capabilities.includes('switch')));
      } catch (e: any) {
        setStError(`SmartThings: ${e?.message ?? 'eroare necunoscută'}`);
      }
    } else setTvs([]);
    setLoading(false);
  }, [tuya, roborock, smartthings]);

  async function tvCmd(fn: () => Promise<void>) {
    try {
      await fn();
    } catch (e: any) {
      setStError(`SmartThings: ${e?.message ?? 'comanda a eșuat'}`);
    }
  }

  useEffect(() => {
    load();
  }, [load]);

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

      <View style={[styles.sectionRow, { marginTop: 16 }]}>
        <Text style={[styles.section, { color: t.fg }]}>Roborock</Text>
        {roborock && (
          <Pressable onPress={onLogoutRoborock}>
            <Text style={{ color: t.accent }}>Deconectare</Text>
          </Pressable>
        )}
      </View>

      {!roborock ? (
        <Pressable onPress={onConnectRoborock} style={[styles.card, { backgroundColor: t.card }]}>
          <Text style={[styles.cardTitle, { color: t.accent }]}>Conectează contul Roborock</Text>
          <Text style={{ color: t.muted }}>Aspiratorul robot</Text>
        </Pressable>
      ) : (
        robots.map((r) => (
          <View key={r.duid} style={[styles.card, { backgroundColor: t.card }]}>
            <View style={styles.row}>
              <Text style={[styles.cardTitle, { color: t.fg, flex: 1 }]}>{r.name}</Text>
              <Text style={{ color: r.online ? t.ok : t.muted }}>{r.online ? '● online' : '○ offline'}</Text>
            </View>
            <Text style={{ color: t.muted }}>
              {r.productName}
              {r.battery != null ? ` · baterie ${r.battery}%` : ''}
            </Text>
          </View>
        ))
      )}
      {rrError && <Text style={{ color: t.error, marginBottom: 12 }}>{rrError}</Text>}

      <View style={[styles.sectionRow, { marginTop: 16 }]}>
        <Text style={[styles.section, { color: t.fg }]}>Samsung (SmartThings)</Text>
        {smartthings && (
          <Pressable onPress={onLogoutSt}>
            <Text style={{ color: t.accent }}>Deconectare</Text>
          </Pressable>
        )}
      </View>

      {!smartthings ? (
        <Pressable onPress={onConnectSt} style={[styles.card, { backgroundColor: t.card }]}>
          <Text style={[styles.cardTitle, { color: t.accent }]}>Conectează SmartThings</Text>
          <Text style={{ color: t.muted }}>Televizoare Samsung</Text>
        </Pressable>
      ) : (
        tvs.map((d) => (
          <View key={d.id} style={[styles.card, { backgroundColor: t.card }]}>
            <Text style={[styles.cardTitle, { color: t.fg }]}>{d.label}</Text>
            <View style={styles.controls}>
              {d.capabilities.includes('switch') && (
                <>
                  <CtrlButton t={t} label="Pornit" onPress={() => tvCmd(() => smartthings.setPower(d.id, true))} />
                  <CtrlButton t={t} label="Oprit" onPress={() => tvCmd(() => smartthings.setPower(d.id, false))} />
                </>
              )}
              {d.capabilities.includes('audioVolume') && (
                <>
                  <CtrlButton t={t} label="Vol +" onPress={() => tvCmd(() => smartthings.volume(d.id, true))} />
                  <CtrlButton t={t} label="Vol −" onPress={() => tvCmd(() => smartthings.volume(d.id, false))} />
                </>
              )}
              {d.capabilities.includes('audioMute') && (
                <CtrlButton t={t} label="Mut" onPress={() => tvCmd(() => smartthings.mute(d.id))} />
              )}
            </View>
          </View>
        ))
      )}
      {stError && <Text style={{ color: t.error, marginBottom: 12 }}>{stError}</Text>}

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

function CtrlButton({ t, label, onPress }: { t: ReturnType<typeof useTheme>; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.ctrl, { borderColor: t.accent }]}>
      <Text style={{ color: t.accent, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, paddingTop: 72, paddingBottom: 40 },
  controls: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  ctrl: { borderWidth: 1, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14 },
  title: { fontSize: 32, fontWeight: '700' },
  subtitle: { fontSize: 15, marginTop: 4, marginBottom: 24 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  section: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  card: { borderRadius: 12, padding: 16, marginBottom: 10 },
  cardTitle: { fontSize: 16, fontWeight: '600', marginBottom: 2 },
  row: { flexDirection: 'row', alignItems: 'center' },
  mono: { fontFamily: 'monospace', fontSize: 12 },
});
