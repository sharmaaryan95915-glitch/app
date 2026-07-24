import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "@/src/context/AuthContext";
import { api } from "@/src/api";
import { colors, fonts, money, radius, spacing } from "@/src/theme";

export default function Profile() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [pending, setPending] = useState({ deposits: 0, withdrawals: 0 });

  const load = useCallback(async () => {
    try {
      const r = await api.get("/wallet/my-requests");
      const dep = (r.deposits || []).filter((x: any) => x.status === "pending").length;
      const wd = (r.withdrawals || []).filter((x: any) => x.status === "pending").length;
      setPending({ deposits: dep, withdrawals: wd });
    } catch {}
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const rows = [
    { icon: "layers-outline", label: "Earning Tasks", onPress: () => router.push("/(tabs)/plans") },
    { icon: "receipt-outline", label: "Transaction History", onPress: () => router.push("/wallet/history") },
    { icon: "card-outline", label: "Payout Accounts", onPress: () => router.push("/accounts") },
    { icon: "arrow-up-circle-outline", label: "Withdraw Funds", onPress: () => router.push("/wallet/withdraw") },
    { icon: "help-buoy-outline", label: "Help & Support", onPress: () => router.push("/help") },
  ];

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingBottom: 100 }}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>Profile</Text>

      <View style={styles.card}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user?.name?.[0]?.toUpperCase() || "V"}</Text>
        </View>
        <Text style={styles.name} testID="profile-name">{user?.name}</Text>
        <Text style={styles.email}>{user?.email}</Text>
        {user?.role === "admin" && (
          <View style={styles.adminBadge}>
            <Ionicons name="shield-checkmark" size={12} color={colors.brand} />
            <Text style={styles.adminBadgeText}>ADMIN</Text>
          </View>
        )}
      </View>

      <View style={styles.balanceRow}>
        <View style={styles.balanceBox}>
          <Text style={styles.balanceLabel}>Balance</Text>
          <Text style={styles.balanceValue}>{money(user?.balance)}</Text>
        </View>
        <View style={styles.balanceBox}>
          <Text style={styles.balanceLabel}>Total Earned</Text>
          <Text style={styles.balanceValue}>{money(user?.total_earned)}</Text>
        </View>
      </View>

      {(pending.deposits > 0 || pending.withdrawals > 0) && (
        <View style={styles.pendingBanner}>
          <Ionicons name="time-outline" size={18} color={colors.warning} />
          <Text style={styles.pendingText}>
            {pending.deposits} deposit(s) & {pending.withdrawals} withdrawal(s) pending approval
          </Text>
        </View>
      )}

      <View style={styles.section}>
        {user?.role === "admin" && (
          <Pressable style={[styles.row, styles.adminRow]} onPress={() => router.push("/admin")} testID="open-admin-button">
            <View style={[styles.rowIcon, { backgroundColor: colors.brand }]}>
              <Ionicons name="grid" size={18} color={colors.onBrandPrimary} />
            </View>
            <Text style={[styles.rowLabel, { color: colors.brand }]}>Admin Panel</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.brand} />
          </Pressable>
        )}
        {rows.map((r) => (
          <Pressable key={r.label} style={styles.row} onPress={r.onPress} testID={`profile-row-${r.label}`}>
            <View style={styles.rowIcon}>
              <Ionicons name={r.icon as any} size={18} color={colors.onSurfaceSecondary} />
            </View>
            <Text style={styles.rowLabel}>{r.label}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </Pressable>
        ))}
      </View>

      <Pressable style={styles.logoutBtn} onPress={logout} testID="logout-button">
        <Ionicons name="log-out-outline" size={18} color={colors.error} />
        <Text style={styles.logoutText}>Log out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  title: { color: colors.onSurface, fontFamily: fonts.display, fontSize: 28, paddingHorizontal: spacing.xl },
  card: { alignItems: "center", marginTop: spacing.lg },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: radius.pill,
    backgroundColor: colors.brandTertiary,
    borderWidth: 2,
    borderColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: colors.brand, fontFamily: fonts.display, fontSize: 34 },
  name: { color: colors.onSurface, fontFamily: fonts.displaySemi, fontSize: 22, marginTop: spacing.md },
  email: { color: colors.onSurfaceTertiary, fontFamily: fonts.regular, fontSize: 14, marginTop: 2 },
  adminBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: spacing.sm,
    backgroundColor: colors.brandTertiary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
  },
  adminBadgeText: { color: colors.brand, fontFamily: fonts.semibold, fontSize: 10, letterSpacing: 1 },
  balanceRow: { flexDirection: "row", gap: spacing.md, paddingHorizontal: spacing.xl, marginTop: spacing.xl },
  balanceBox: {
    flex: 1,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  balanceLabel: { color: colors.onSurfaceTertiary, fontFamily: fonts.regular, fontSize: 12 },
  balanceValue: { color: colors.onSurface, fontFamily: fonts.display, fontSize: 22, marginTop: 4 },
  pendingBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginHorizontal: spacing.xl,
    marginTop: spacing.lg,
    backgroundColor: "rgba(217,119,6,0.12)",
    borderColor: colors.warning,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  pendingText: { color: colors.warning, fontFamily: fonts.medium, fontSize: 12, flex: 1 },
  section: { marginTop: spacing.xl, paddingHorizontal: spacing.xl, gap: spacing.md },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  adminRow: { borderColor: colors.brand },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: { flex: 1, color: colors.onSurface, fontFamily: fonts.medium, fontSize: 15 },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    marginHorizontal: spacing.xl,
    marginTop: spacing.xl,
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.error,
  },
  logoutText: { color: colors.error, fontFamily: fonts.semibold, fontSize: 15 },
});
