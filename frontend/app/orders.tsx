import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { api } from "@/src/api";
import { colors, fonts, money, radius, shadow, spacing } from "@/src/theme";

const STATUS: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  pending: { label: "Pending Approval", color: "#B45309", bg: "#FEF3C7", icon: "time-outline" },
  approved: { label: "Approved", color: colors.success, bg: "#E3F5EC", icon: "checkmark-done" },
  rejected: { label: "Rejected", color: colors.error, bg: "#FDECEC", icon: "close-circle-outline" },
};

function fmtDate(s?: string) {
  if (!s) return "";
  try {
    const d = new Date(s);
    return d.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  } catch { return s; }
}

export default function Orders() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api.get("/tasks/my-payments");
      setOrders(r.payments || []);
    } catch {}
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const renderItem = ({ item }: { item: any }) => {
    const st = STATUS[item.status] || STATUS.pending;
    return (
      <View style={styles.card} testID={`order-${item.order_id}`}>
        <View style={styles.top}>
          <View style={{ flex: 1 }}>
            <Text style={styles.task}>{item.task_name}</Text>
            <Text style={styles.date}>{fmtDate(item.created_at)}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: st.bg }]}>
            <Ionicons name={st.icon} size={13} color={st.color} />
            <Text style={[styles.badgeText, { color: st.color }]}>{st.label}</Text>
          </View>
        </View>

        <View style={styles.rowsCard}>
          <Row label="Order ID" value={item.order_id} mono />
          <Row label="Paid Amount" value={item.currency === "USDT" && item.usdt_amount ? `$${item.usdt_amount} (${money(item.amount)})` : money(item.amount)} />
          <Row label="Profit / Reward" value={`+${money(item.reward)}`} highlight />
          <Row label="Wallet Credit" value={money(item.credit)} bold />
          {item.utr ? <Row label="UTR / Txn ID" value={item.utr} mono /> : null}
          {item.status === "rejected" && item.note ? <Row label="Reason" value={item.note} /> : null}
        </View>

        {item.status === "pending" && (
          <View style={styles.hint} testID="order-auto-hint">
            <Ionicons name="hourglass-outline" size={14} color={colors.brand} />
            <Text style={styles.hintText}>Auto-approves within 15 min if not reviewed. Credit will be added to your wallet.</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/profile"))} style={styles.backBtn} testID="orders-back-button">
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>My Orders</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.brand} style={{ marginTop: spacing.xxl }} />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(o) => o.payment_id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
          ListEmptyComponent={
            <View style={styles.empty} testID="orders-empty">
              <Ionicons name="receipt-outline" size={48} color={colors.muted} />
              <Text style={styles.emptyText}>No orders yet. Buy an RP plan to get started.</Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

function Row({ label, value, mono, bold, highlight }: { label: string; value: string; mono?: boolean; bold?: boolean; highlight?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, mono && styles.mono, bold && styles.bold, highlight && { color: colors.success }]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: colors.onSurface, fontFamily: fonts.displaySemi, fontSize: 18 },
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.lg, ...shadow.soft },
  top: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  task: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: 16 },
  date: { color: colors.muted, fontFamily: fonts.regular, fontSize: 12, marginTop: 2 },
  badge: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 5 },
  badgeText: { fontFamily: fonts.semibold, fontSize: 11 },
  rowsCard: { backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, paddingHorizontal: spacing.md, marginTop: spacing.md },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: spacing.sm },
  rowLabel: { color: colors.onSurfaceTertiary, fontFamily: fonts.medium, fontSize: 13 },
  rowValue: { color: colors.onSurface, fontFamily: fonts.medium, fontSize: 13, maxWidth: "58%" },
  mono: { fontFamily: fonts.semibold, letterSpacing: 0.5 },
  bold: { color: colors.brand, fontFamily: fonts.bold, fontSize: 15 },
  hint: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.md, backgroundColor: colors.brandTertiary, borderRadius: radius.sm, padding: spacing.sm },
  hintText: { flex: 1, color: colors.onBrandTertiary, fontFamily: fonts.regular, fontSize: 11, lineHeight: 15 },
  empty: { alignItems: "center", paddingVertical: spacing.xxxl, gap: spacing.md },
  emptyText: { color: colors.muted, fontFamily: fonts.regular, fontSize: 14, textAlign: "center", paddingHorizontal: spacing.xl },
});
