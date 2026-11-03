import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { loginWithCode, requestCode, RoborockSession } from '../roborock/api';
import { useTheme } from '../theme';

export default function RoborockLogin({
  onDone,
  onCancel,
}: {
  onDone: (s: RoborockSession) => void;
  onCancel: () => void;
}) {
  const t = useTheme();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [ctx, setCtx] = useState<{ baseUrl: string; deviceId: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode() {
    setBusy(true);
    setError(null);
    try {
      setCtx(await requestCode(email.trim()));
      setStep('code');
    } catch (e: any) {
      setError(e?.message ?? 'Eroare la trimiterea codului.');
    } finally {
      setBusy(false);
    }
  }

  async function submitCode() {
    if (!ctx) return;
    setBusy(true);
    setError(null);
    try {
      onDone(await loginWithCode(email.trim(), code.trim(), ctx.baseUrl, ctx.deviceId));
    } catch (e: any) {
      setError(e?.message ?? 'Eroare la autentificare.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={styles.container}>
      <Text style={[styles.title, { color: t.fg }]}>Conectare Roborock</Text>

      {step === 'email' ? (
        <>
          <Text style={[styles.p, { color: t.muted }]}>Emailul contului Roborock. Vei primi un cod pe email.</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="email@exemplu.com"
            placeholderTextColor={t.muted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            style={[styles.input, { color: t.fg, backgroundColor: t.card }]}
          />
          <Pressable
            disabled={!email.trim() || busy}
            onPress={sendCode}
            style={[styles.button, { backgroundColor: t.accent, opacity: !email.trim() || busy ? 0.5 : 1 }]}
          >
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Trimite codul</Text>}
          </Pressable>
        </>
      ) : (
        <>
          <Text style={[styles.p, { color: t.muted }]}>Introdu codul primit pe {email.trim()}.</Text>
          <TextInput
            value={code}
            onChangeText={setCode}
            placeholder="Cod din email"
            placeholderTextColor={t.muted}
            autoCapitalize="none"
            keyboardType="number-pad"
            style={[styles.input, { color: t.fg, backgroundColor: t.card }]}
          />
          <Pressable
            disabled={!code.trim() || busy}
            onPress={submitCode}
            style={[styles.button, { backgroundColor: t.accent, opacity: !code.trim() || busy ? 0.5 : 1 }]}
          >
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Conectează</Text>}
          </Pressable>
          <Pressable onPress={() => setStep('email')} style={styles.link}>
            <Text style={{ color: t.accent }}>Schimbă emailul</Text>
          </Pressable>
        </>
      )}

      {error && <Text style={[styles.p, { color: t.error, marginTop: 12 }]}>{error}</Text>}

      <Pressable onPress={onCancel} style={styles.link}>
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
  link: { marginTop: 20, alignSelf: 'center', padding: 8 },
});
