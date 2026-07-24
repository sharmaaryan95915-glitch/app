import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { api } from "@/src/api";
import { useToast } from "@/src/components/Toast";
import { colors, fonts, money, radius, spacing } from "@/src/theme";

type Tab = "payments" | "withdrawals" | "support" | "users";

export default function Admin() {
  const toast = useToast();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [tab, setTab] = useState<Tab>("payments");
  const [summary, setSummary] = useState<any>({});
  const [payments, setPayments] = useState<any[]>([]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [threads, setThreads] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [zoom, setZoom] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [s, p, w, t, u] = await Promise.all([
        api.get("/admin/summary"),
        api.get("/admin/payments?status=pending"),
        api.get("/admin/withdrawals?status=pending"),
        api.get("/admin/support/threads"),
        api.get("/admin/users"),
      ]);
      setSummary(s);
      setPayments(p.payments || []);
      setWithdrawals(w.withdrawals || []);
      setThreads(t.threads || []);
      setUsers(u.users || []);
    } catch (e: any) {
      toast.show(e.message || "Failed to load", "error");
    }
    setLoading(false);
  }, [toast]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const actPayment = async (id: string, action: "approve" | "reject") => {
    setBusy(id + action);
    try {
      await api.post(`/admin/payments/${id}/${action}`, { note: null });
      Haptics.notificationAsync(action === "approve" ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning);
      toast.show(`Payment ${action}d`, action === "approve" ? "success" : "info");
      await load();
    } catch (e: any) { toast.show(e.message || "Failed", "error"); }
    finally { setBusy(null); }
  };

  const actWithdraw = async (id: string, action: "approve" | "reject") => {
    setBusy(id + action);
    try {
      await api.post(`/admin/withdrawals/${id}/${action}`, { note: null });
      Haptics.notificationAsync(action === "approve" ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning);
      toast.show(`Withdrawal ${action}d`, action === "approve" ? "success" : "info");
      await load();
    } catch (e: any) { toast.show(e.message || "Failed", "error"); }
    finally { setBusy(null); }
  };

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "payments", label: "Payments", count: summary.pending_payments || 0 },
    { key: "withdrawals", label: "Withdraw", count: summary.pending_withdrawals || 0 },
    { key: "support", label: "Support", count: summary.open_support || 0 },
    { key: "users", label: "Users", count: summary.total_users || 0 },
  ];

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/profile"))} style={styles.backBtn} testID="admin-back-button">
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Admin Panel</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.segment}>
        {tabs.map((t) => (
          <Pressable key={t.key} style={[styles.segBtn, tab === t.key && styles.segActive]} onPress={() => setTab(t.key)} testID={`admin-tab-${t.key}`}>
            <Text style={[styles.segText, { color: tab === t.key ? colors.onBrandPrimary : colors.onSurfaceSecondary }]}>{t.label} ({t.count})</Text>
          </Pressable>
        ))}
      </ScrollView>

      {loading ? (
        <ActivityIndicator color={colors.brand} style={{ marginTop: spacing.xxl }} />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + spacing.xl }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
        >
          {tab === "payments" && (payments.length === 0 ? <Empty label="No pending payments" /> :
            payments.map((p) => (
              <View key={p.payment_id} style={styles.card} testID={`admin-payment-${p.payment_id}`}>
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardName}>{p.user_name}</Text>
                    <Text style={styles.cardEmail} numberOfLines={1}>{p.user_email}</Text>
                    <Text style={styles.taskTag}>{p.task_name} · {p.category === "reward" ? "Premium" : "Daily"}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={styles.cardAmount}>{money(p.amount)}</Text>
                    <Text style={styles.creditText}>credit {money(p.credit)}</Text>
                  </View>
                </View>
                {p.screenshot ? (
                  <Pressable onPress={() => setZoom(p.screenshot)} testID={`view-screenshot-${p.payment_id}`}>
                    <Image source={{ uri: p.screenshot }} style={styles.shot} contentFit="cover" />
                    <View style={styles.shotHint}><Ionicons name="expand" size={14} color="#fff" /><Text style={styles.shotHintText}>Tap to view</Text></View>
                  </Pressable>
                ) : <Text style={styles.noShot}>No screenshot</Text>}
                <View style={styles.actions}>
                  <Pressable style={[styles.actBtn, { backgroundColor: colors.error }]} onPress={() => actPayment(p.payment_id, "reject")} disabled={!!busy} testID={`reject-payment-${p.payment_id}`}>
                    {busy === p.payment_id + "reject" ? <ActivityIndicator color="#fff" size="small" /> : <><Ionicons name="close" size={16} color="#fff" /><Text style={styles.actText}>Reject</Text></>}
                  </Pressable>
                  <Pressable style={[styles.actBtn, { backgroundColor: colors.success }]} onPress={() => actPayment(p.payment_id, "approve")} disabled={!!busy} testID={`approve-payment-${p.payment_id}`}>
                    {busy === p.payment_id + "approve" ? <ActivityIndicator color="#fff" size="small" /> : <><Ionicons name="checkmark" size={16} color="#fff" /><Text style={styles.actText}>Approve</Text></>}
                  </Pressable>
                </View>
              </View>
            ))
          )}

          {tab === "withdrawals" && (withdrawals.length === 0 ? <Empty label="No pending withdrawals" /> :
            withdrawals.map((w) => (
              <View key={w.request_id} style={styles.card} testID={`admin-withdrawal-${w.request_id}`}>
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardName}>{w.user_name}</Text>
                    <Text style={styles.cardEmail} numberOfLines={1}>{w.user_email}</Text>
                  </View>
                  <Text style={styles.cardAmount}>{money(w.amount)}</Text>
                </View>
                <View style={styles.detail}>
                  <Text style={styles.detailLabel}>{w.method} · {w.holder_name}</Text>
                  <Text style={styles.detailValue}>{w.upi_id}</Text>
                </View>
                <View style={styles.actions}>
                  <Pressable style={[styles.actBtn, { backgroundColor: colors.error }]} onPress={() => actWithdraw(w.request_id, "reject")} disabled={!!busy} testID={`reject-withdrawal-${w.request_id}`}>
                    {busy === w.request_id + "reject" ? <ActivityIndicator color="#fff" size="small" /> : <><Ionicons name="close" size={16} color="#fff" /><Text style={styles.actText}>Reject</Text></>}
                  </Pressable>
                  <Pressable style={[styles.actBtn, { backgroundColor: colors.success }]} onPress={() => actWithdraw(w.request_id, "approve")} disabled={!!busy} testID={`approve-withdrawal-${w.request_id}`}>
                    {busy === w.request_id + "approve" ? <ActivityIndicator color="#fff" size="small" /> : <><Ionicons name="checkmark" size={16} color="#fff" /><Text style={styles.actText}>Approve</Text></>}
                  </Pressable>
                </View>
              </View>
            ))
          )}

          {tab === "support" && (threads.length === 0 ? <Empty label="No support messages" /> :
            threads.map((t) => (
              <Pressable key={t.user_id} style={styles.threadRow} onPress={() => router.push({ pathname: "/admin/support/[userId]", params: { userId: t.user_id, name: t.user_name } })} testID={`support-thread-${t.user_id}`}>
                <View style={styles.threadAvatar}><Text style={styles.threadInitial}>{t.user_name?.[0]?.toUpperCase() || "?"}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.threadName}>{t.user_name}</Text>
                  <Text style={styles.threadLast} numberOfLines={1}>{t.last_text}</Text>
                </View>
                {t.unread > 0 && <View style={styles.unread}><Text style={styles.unreadText}>{t.unread}</Text></View>}
                <Ionicons name="chevron-forward" size={18} color={colors.muted} />
              </Pressable>
            ))
          )}

          {tab === "users" && users.map((u) => (
            <View key={u.user_id} style={styles.userRow} testID={`admin-user-${u.user_id}`}>
              <View style={styles.threadAvatar}><Text style={styles.threadInitial}>{u.name?.[0]?.toUpperCase() || "?"}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.threadName}>{u.name}{u.role === "admin" ? " · Admin" : ""}</Text>
                <Text style={styles.threadLast} numberOfLines={1}>{u.email}</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={styles.cardAmount}>{money(u.balance)}</Text>
                <Text style={styles.userCode}>{u.referral_code}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {zoom && (
        <Pressable style={styles.zoomOverlay} onPress={() => setZoom(null)} testID="screenshot-zoom">
          <Image source={{ uri: zoom }} style={styles.zoomImg} contentFit="contain" />
          <Text style={styles.zoomHint}>Tap anywhere to close</Text>
        </Pressable>
      )}
    </View>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <View style={styles.empty} testID="admin-empty">
      <Ionicons name="checkmark-done-circle-outline" size={48} color={colors.muted} />
      <Text style={styles.emptyText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: colors.onSurface, fontFamily: fonts.displaySemi, fontSize: 18 },
  segment: { paddingHorizontal: spacing.xl, paddingVertical: spacing.md, gap: spacing.sm },
  segBtn: { height: 38, borderRadius: radius.pill, paddingHorizontal: spacing.lg, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  segActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  segText: { fontFamily: fonts.medium, fontSize: 13 },
  empty: { alignItems: "center", paddingVertical: spacing.xxxl, gap: spacing.md },
  emptyText: { color: colors.muted, fontFamily: fonts.regular, fontSize: 14 },
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, marginBottom: spacing.lg },
  cardTop: { flexDirection: "row", alignItems: "flex-start" },
  cardName: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: 16 },
  cardEmail: { color: colors.muted, fontFamily: fonts.regular, fontSize: 12, marginTop: 2 },
  taskTag: { color: colors.brand, fontFamily: fonts.medium, fontSize: 12, marginTop: 4 },
  cardAmount: { color: colors.brand, fontFamily: fonts.display, fontSize: 22 },
  creditText: { color: colors.success, fontFamily: fonts.medium, fontSize: 12, marginTop: 2 },
  shot: { width: "100%", height: 200, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary, marginTop: spacing.md },
  shotHint: { position: "absolute", bottom: spacing.md + 4, right: spacing.md, flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(0,0,0,0.7)", borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 4 },
  shotHintText: { color: "#fff", fontFamily: fonts.medium, fontSize: 11 },
  noShot: { color: colors.muted, fontFamily: fonts.regular, fontSize: 12, marginTop: spacing.md },
  detail: { flexDirection: "row", justifyContent: "space-between", backgroundColor: colors.surfaceTertiary, borderRadius: radius.sm, padding: spacing.md, marginTop: spacing.md },
  detailLabel: { color: colors.muted, fontFamily: fonts.regular, fontSize: 13 },
  detailValue: { color: colors.onSurface, fontFamily: fonts.medium, fontSize: 13 },
  actions: { flexDirection: "row", gap: spacing.md, marginTop: spacing.lg },
  actBtn: { flex: 1, height: 46, borderRadius: radius.md, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs },
  actText: { color: "#fff", fontFamily: fonts.semibold, fontSize: 14 },
  threadRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.md },
  threadAvatar: { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  threadInitial: { color: colors.brand, fontFamily: fonts.semibold, fontSize: 18 },
  threadName: { color: colors.onSurface, fontFamily: fonts.medium, fontSize: 15 },
  threadLast: { color: colors.muted, fontFamily: fonts.regular, fontSize: 12, marginTop: 2 },
  unread: { minWidth: 22, height: 22, borderRadius: 11, backgroundColor: colors.error, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  unreadText: { color: "#fff", fontFamily: fonts.semibold, fontSize: 11 },
  userRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.md },
  userCode: { color: colors.brand, fontFamily: fonts.regular, fontSize: 11, marginTop: 2 },
  zoomOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.94)", alignItems: "center", justifyContent: "center", zIndex: 1000 },
  zoomImg: { width: "92%", height: "80%" },
  zoomHint: { color: colors.muted, fontFamily: fonts.regular, fontSize: 13, marginTop: spacing.lg },
});
