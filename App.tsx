import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, useColorScheme } from 'react-native';

const DEVICES = [
  { name: 'Cameră Callex', source: 'Tuya' },
  { name: 'Litieră iHunt V7', source: 'Tuya' },
  { name: 'Dezumidificatoare AlecoAir', source: 'de verificat' },
  { name: 'TV Samsung', source: 'SmartThings' },
  { name: 'Roborock', source: 'Roborock cloud' },
  { name: 'Airfryer Philips', source: 'local' },
];

export default function App() {
  const dark = useColorScheme() === 'dark';
  const fg = dark ? '#f2f2f2' : '#1a1a1a';
  const muted = dark ? '#9a9a9a' : '#6b6b6b';
  const card = dark ? '#1f1f1f' : '#f2f2f2';

  return (
    <View style={[styles.container, { backgroundColor: dark ? '#111' : '#fff' }]}>
      <Text style={[styles.title, { color: fg }]}>Domo</Text>
      <Text style={[styles.subtitle, { color: muted }]}>Aparatele casei, într-un singur loc</Text>
      {DEVICES.map((d) => (
        <View key={d.name} style={[styles.card, { backgroundColor: card }]}>
          <Text style={[styles.cardTitle, { color: fg }]}>{d.name}</Text>
          <Text style={{ color: muted }}>{d.source} · neconectat</Text>
        </View>
      ))}
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20, paddingTop: 72 },
  title: { fontSize: 32, fontWeight: '700' },
  subtitle: { fontSize: 15, marginTop: 4, marginBottom: 24 },
  card: { borderRadius: 12, padding: 16, marginBottom: 10 },
  cardTitle: { fontSize: 16, fontWeight: '600', marginBottom: 2 },
});
