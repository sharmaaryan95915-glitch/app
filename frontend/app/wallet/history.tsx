import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { api } from "@/src/api";
import { TxRow } from "@/src/components/TxRow";
import { colors, fonts, spacing } from "@/src/theme";

export default function History() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [txs, setTxs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const r = await api.get("/wallet/transactions");
      setTxs(r.transactions || []);
    } catch {}
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} testID="history-back-button">
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Transaction History</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.brand} style={{ marginTop: spacing.xxl }} />
      ) : (
        <FlatList
          data={txs}
          keyExtractor={(t) => t.tx_id}
          renderItem={({ item }) => <TxRow tx={item} />}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          contentContainerStyle={{ paddingVertical: spacing.md, paddingBottom: insets.bottom + spacing.xl }}
          ListEmptyComponent={<Text style={styles.empty}>No transactions yet.</Text>}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: colors.onSurface, fontFamily: fonts.displaySemi, fontSize: 18 },
  sep: { height: 1, backgroundColor: colors.divider, marginHorizontal: spacing.xl },
  empty: { color: colors.muted, fontFamily: fonts.regular, fontSize: 14, textAlign: "center", marginTop: spacing.xxl },
});
