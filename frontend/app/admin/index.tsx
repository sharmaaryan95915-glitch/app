import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { api } from "@/src/api";
import { useToast } from "@/src/components/Toast";
import { colors, fonts, money, radius, spacing } from "@/src/theme";

type Tab = "deposits" | "withdrawals" | "users";

export default function Admin() {
  const toast = useToast();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [tab, setTab] = useState<Tab>("deposits");
  const [summary, setSummary] = useState<any>({});
  const [deposits, setDeposits] = useState<any[]>([]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [s, d, w, u] = await Promise.all([
        api.get("/admin/summary"),
        api.get("/admin/deposits?status=pending"),
        api.get("/admin/withdrawals?status=pending"),
        api.get("/admin/users"),
      ]);
      setSummary(s);
      setDeposits(d.deposits || []);
      setWithdrawals(w.withdrawals || []);
      setUsers(u.users || []);
    } catch (e: any) {
      toast.show(e.message || "Failed to load", "error");
    }
    setLoading(false);
  }, [toast]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const act = async (kind: "deposits" | "withdrawals", id: string, action: "approve" | "reject") => {
    setBusy(id + action);
    try {
      await api.post(`/admin/${kind}/${id}/${action}`, { note: null });
      Haptics.notificationAsync(
        action === "approve" ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning,
      );
      toast.show(`Request ${action}d`, action === "approve" ? "success" : "info");
      await load();
    } catch (e: any) {
      toast.show(e.message || "Action failed", "error");
    } finally {
      setBusy(null);
    }
  };

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "deposits", label: "Deposits", count: summary.pending_deposits || 0 },
    { key: "withdrawals", label: "Withdrawals", count: summary.pending_withdrawals || 0 },
    { key: "users", label: "Users", count: summary.total_users || 0 },
  ];

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} testID="admin-back-button">
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Admin Panel</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.segment}>
        {tabs.map((t) => (
          <Pressable
            key={t.key}
            style={[styles.segBtn, tab === t.key && styles.segBtnActive]}
            onPress={() => setTab(t.key)}
            testID={`admin-tab-${t.key}`}
          >
            <Text style={[styles.segText, { color: tab === t.key ? colors.onBrandPrimary : colors.onSurfaceSecondary }]}>
              {t.label} ({t.count})
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={colors.brand} style={{ marginTop: spacing.xxl }} />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + spacing.xl }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
        >
          {tab === "deposits" && (
            deposits.length === 0 ? (
              <Empty label="No pending deposits" />
            ) : (
              deposits.map((d) => (
                <RequestCard
                  key={d.request_id}
                  title={d.user_name}
                  email={d.user_email}
                  amount={d.amount}
                  detailLabel="UPI Ref"
                  detailValue={d.upi_reference}
                  busy={busy}
                  id={d.request_id}
                  onApprove={() => act("deposits", d.request_id, "approve")}
                  onReject={() => act("deposits", d.request_id, "reject")}
                />
              ))
            )
          )}

          {tab === "withdrawals" && (
            withdrawals.length === 0 ? (
              <Empty label="No pending withdrawals" />
            ) : (
              withdrawals.map((w) => (
                <RequestCard
                  key={w.request_id}
                  title={w.user_name}
                  email={w.user_email}
                  amount={w.amount}
                  detailLabel="Pay to UPI"
                  detailValue={w.upi_id}
                  busy={busy}
                  id={w.request_id}
                  onApprove={() => act("withdrawals", w.request_id, "approve")}
                  onReject={() => act("withdrawals", w.request_id, "reject")}
                />
              ))
            )
          )}

          {tab === "users" && (
            users.map((u) => (
              <View key={u.user_id} style={styles.userRow} testID={`admin-user-${u.user_id}`}>
                <View style={styles.userAvatar}>
                  <Text style={styles.userInitial}>{u.name?.[0]?.toUpperCase() || "?"}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.userName}>{u.name} {u.role === "admin" && "· Admin"}</Text>
                  <Text style={styles.userEmail} numberOfLines={1}>{u.email}</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={styles.userBalance}>{money(u.balance)}</Text>
                  <Text style={styles.userCode}>{u.referral_code}</Text>
                </View>
              </View>
            ))
          )}
        </ScrollView>
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

function RequestCard({
  title, email, amount, detailLabel, detailValue, onApprove, onReject, busy, id,
}: {
  title: string; email: string; amount: number; detailLabel: string; detailValue: string;
  onApprove: () => void; onReject: () => void; busy: string | null; id: string;
}) {
  return (
    <View style={styles.reqCard} testID={`admin-request-${id}`}>
      <View style={styles.reqTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.reqName}>{title}</Text>
          <Text style={styles.reqEmail} numberOfLines={1}>{email}</Text>
        </View>
        <Text style={styles.reqAmount}>{money(amount)}</Text>
      </View>
      <View style={styles.reqDetail}>
        <Text style={styles.reqDetailLabel}>{detailLabel}</Text>
        <Text style={styles.reqDetailValue}>{detailValue}</Text>
      </View>
      <View style={styles.reqActions}>
        <Pressable
          style={[styles.reqBtn, { backgroundColor: colors.error }]}
          onPress={onReject}
          disabled={!!busy}
          testID={`reject-${id}`}
        >
          {busy === id + "reject" ? <ActivityIndicator color="#fff" size="small" /> : (
            <><Ionicons name="close" size={16} color="#fff" /><Text style={styles.reqBtnText}>Reject</Text></>
          )}
        </Pressable>
        <Pressable
          style={[styles.reqBtn, { backgroundColor: colors.success }]}
          onPress={onApprove}
          disabled={!!busy}
          testID={`approve-${id}`}
        >
          {busy === id + "approve" ? <ActivityIndicator color="#fff" size="small" /> : (
            <><Ionicons name="checkmark" size={16} color="#fff" /><Text style={styles.reqBtnText}>Approve</Text></>
          )}
        </Pressable>
      </View>
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
  segment: {
    flexDirection: "row",
    margin: spacing.xl,
    marginBottom: 0,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 4,
    gap: 4,
  },
  segBtn: { flex: 1, height: 40, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  segBtnActive: { backgroundColor: colors.brand },
  segText: { fontFamily: fonts.medium, fontSize: 12 },
  empty: { alignItems: "center", paddingVertical: spacing.xxxl, gap: spacing.md },
  emptyText: { color: colors.muted, fontFamily: fonts.regular, fontSize: 14 },
  reqCard: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  reqTop: { flexDirection: "row", alignItems: "center" },
  reqName: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: 16 },
  reqEmail: { color: colors.muted, fontFamily: fonts.regular, fontSize: 12, marginTop: 2 },
  reqAmount: { color: colors.brand, fontFamily: fonts.display, fontSize: 24 },
  reqDetail: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  reqDetailLabel: { color: colors.muted, fontFamily: fonts.regular, fontSize: 13 },
  reqDetailValue: { color: colors.onSurface, fontFamily: fonts.medium, fontSize: 13 },
  reqActions: { flexDirection: "row", gap: spacing.md, marginTop: spacing.lg },
  reqBtn: {
    flex: 1,
    height: 46,
    borderRadius: radius.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
  },
  reqBtnText: { color: "#fff", fontFamily: fonts.semibold, fontSize: 14 },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  userAvatar: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  userInitial: { color: colors.brand, fontFamily: fonts.semibold, fontSize: 18 },
  userName: { color: colors.onSurface, fontFamily: fonts.medium, fontSize: 15 },
  userEmail: { color: colors.muted, fontFamily: fonts.regular, fontSize: 12, marginTop: 2 },
  userBalance: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: 15 },
  userCode: { color: colors.brand, fontFamily: fonts.regular, fontSize: 11, marginTop: 2 },
});
