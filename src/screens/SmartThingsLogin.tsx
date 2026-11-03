import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { connect, StSession } from '../smartthings/api';
import { useTheme } from '../theme';

export default function SmartThingsLogin({
  onDone,
  onCancel,
}: {
  onDone: (s: StSession) => void;
  onCancel: () => void;
}) {
  const t = useTheme();
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    setBusy(true);
    setError(null);
    try {
      onDone(await connect(clientId.trim(), clientSecret.trim()));
    } catch (e: any) {
      setError(e?.message ?? 'Eroare la conectare.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={styles.container}>
      <Text style={[styles.title, { color: t.fg }]}>Conectare SmartThings</Text>
      <Text style={[styles.p, { color: t.muted }]}>
        Creează o aplicație OAuth în SmartThings (o singură dată) și lipește datele ei aici. Pașii sunt în instrucțiunile
        din chat. Redirect URI trebuie să fie exact:
      </Text>
      <Text style={[styles.mono, { color: t.fg, backgroundColor: t.card }]}>domo://oauth</Text>

      <TextInput
        value={clientId}
        onChangeText={setClientId}
        placeholder="Client ID"
        placeholderTextColor={t.muted}
        autoCapitalize="none"
        autoCorrect={false}
        style={[styles.input, { color: t.fg, backgroundColor: t.card }]}
      />
      <TextInput
        value={clientSecret}
        onChangeText={setClientSecret}
        placeholder="Client Secret"
        placeholderTextColor={t.muted}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
        style={[styles.input, { color: t.fg, backgroundColor: t.card }]}
      />

      <Pressable
        disabled={!clientId.trim() || !clientSecret.trim() || busy}
        onPress={go}
        style={[
          styles.button,
          { backgroundColor: t.accent, opacity: !clientId.trim() || !clientSecret.trim() || busy ? 0.5 : 1 },
        ]}
      >
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Conectează cu SmartThings</Text>}
      </Pressable>

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
  p: { fontSize: 15, lineHeight: 22, marginBottom: 12 },
  mono: { fontFamily: 'monospace', fontSize: 15, padding: 10, borderRadius: 8, marginBottom: 16 },
  input: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, marginBottom: 12 },
  button: { borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  link: { marginTop: 20, alignSelf: 'center', padding: 8 },
});
