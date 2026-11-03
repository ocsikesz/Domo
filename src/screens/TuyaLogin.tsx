import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { pollQrLogin, saveSession, startQrLogin, TuyaSession } from '../tuya/api';
import { useTheme } from '../theme';

const POLL_MS = 2500;
const TIMEOUT_MS = 3 * 60_000;

export default function TuyaLogin({ onDone, onCancel }: { onDone: (s: TuyaSession) => void; onCancel: () => void }) {
  const t = useTheme();
  const [userCode, setUserCode] = useState('');
  const [qr, setQr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };
  useEffect(() => stop, []);

  async function begin() {
    setError(null);
    setBusy(true);
    try {
      const code = userCode.trim();
      const { qr, token } = await startQrLogin(code);
      setQr(qr);
      const started = Date.now();
      timer.current = setInterval(async () => {
        if (Date.now() - started > TIMEOUT_MS) {
          stop();
          setQr(null);
          setError('Codul QR a expirat. Încearcă din nou.');
          return;
        }
        try {
          const session = await pollQrLogin(code, token);
          if (session) {
            stop();
            await saveSession(session);
            onDone(session);
          }
        } catch {
          // network hiccup: keep polling
        }
      }, POLL_MS);
    } catch (e: any) {
      setError(e?.message ?? 'Nu am putut porni autentificarea.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={styles.container}>
      <Text style={[styles.title, { color: t.fg }]}>Conectare Smart Life</Text>

      {!qr ? (
        <>
          <Text style={[styles.p, { color: t.muted }]}>
            1. În Smart Life: Eu → Setări (rotița) → Cont și securitate → Cod utilizator (User Code).{'\n'}
            2. Copiază codul aici.
          </Text>
          <TextInput
            value={userCode}
            onChangeText={setUserCode}
            placeholder="Cod utilizator"
            placeholderTextColor={t.muted}
            autoCapitalize="none"
            autoCorrect={false}
            style={[styles.input, { color: t.fg, backgroundColor: t.card }]}
          />
          <Pressable
            disabled={!userCode.trim() || busy}
            onPress={begin}
            style={[styles.button, { backgroundColor: t.accent, opacity: !userCode.trim() || busy ? 0.5 : 1 }]}
          >
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Generează codul QR</Text>}
          </Pressable>
        </>
      ) : (
        <>
          <View style={styles.qrBox}>
            <QRCode value={qr} size={240} backgroundColor="#ffffff" color="#000000" />
          </View>
          <Text style={[styles.p, { color: t.muted }]}>
            Scanează codul cu Smart Life (iconița de scanare din colțul ecranului principal) și confirmă.{'\n\n'}
            Dacă Smart Life e pe același telefon: fă o captură de ecran, apoi în scanerul Smart Life alege poza din
            galerie. Sau scanează de pe alt telefon logat în același cont Smart Life.
          </Text>
          <View style={styles.row}>
            <ActivityIndicator color={t.accent} />
            <Text style={{ color: t.muted, marginLeft: 8 }}>Aștept confirmarea…</Text>
          </View>
        </>
      )}

      {error && <Text style={[styles.p, { color: t.error }]}>{error}</Text>}

      <Pressable
        onPress={() => {
          stop();
          onCancel();
        }}
        style={styles.link}
      >
        <Text style={{ color: t.accent }}>Înapoi</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, paddingTop: 72, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 16 },
  p: { fontSize: 15, lineHeight: 22, marginBottom: 16 },
  input: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, marginBottom: 12 },
  button: { borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  qrBox: { alignSelf: 'center', padding: 16, backgroundColor: '#fff', borderRadius: 12, marginBottom: 16 },
  row: { flexDirection: 'row', alignItems: 'center' },
  link: { marginTop: 24, alignSelf: 'center', padding: 8 },
});
