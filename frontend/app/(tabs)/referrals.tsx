import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "@/src/context/AuthContext";
import { api } from "@/src/api";
import { colors, fonts, money, radius, shadow, spacing } from "@/src/theme";

export default function SellRP() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [accounts, setAccounts] = useState<any[]>([]);
  const [pending, setPending] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [a, r] = await Promise.all([api.get("/accounts"), api.get("/wallet/my-requests")]);
      setAccounts(a.accounts || []);
      setPending((r.withdrawals || []).filter((x: any) => x.status === "pending").length);
      await refreshUser();
    } catch {}
    setLoading(false);
  }, [refreshUser]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Text style={styles.headerTitle}>Sell RP</Text>
      </View>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
      >
        {/* Today's overview */}
        <Animated.View entering={FadeInDown}>
          <LinearGradient colors={["#EDE9FE", "#F3F0FF"]} style={styles.overview}>
            <Text style={styles.ovLabel}>Today&apos;s Overview</Text>
            <Text style={styles.ovValue} testID="sell-balance">{money(user?.balance)}</Text>
            <Text style={styles.ovSub}>Amount available to sell</Text>
            <View style={styles.ovRow}>
              <View style={styles.ovStat}>
                <Text style={styles.ovStatV}>{money(user?.total_earned)}</Text>
                <Text style={styles.ovStatL}>Total earned</Text>
              </View>
              <View style={styles.ovDivider} />
              <View style={styles.ovStat}>
                <Text style={styles.ovStatV}>{pending}</Text>
                <Text style={styles.ovStatL}>Pending sells</Text>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* Sell + Record */}
        <View style={styles.actionRow}>
          <Pressable style={styles.sellBtn} onPress={() => router.push("/wallet/withdraw")} testID="sell-withdraw-button">
            <Ionicons name="cash-outline" size={18} color="#fff" />
            <Text style={styles.sellText}>Sell RP / Withdraw</Text>
          </Pressable>
          <Pressable style={styles.recordBtn} onPress={() => router.push("/wallet/history")} testID="sell-record-button">
            <Ionicons name="time-outline" size={18} color={colors.brand} />
            <Text style={styles.recordText}>Record</Text>
          </Pressable>
        </View>

        {/* Wallet Information */}
        <View style={styles.walletHeader}>
          <Text style={styles.sectionTitle}>Wallet Information</Text>
          <Pressable onPress={() => router.push("/accounts")} testID="sell-add-wallet-link">
            <Text style={styles.addLink}>+ Add Wallet</Text>
          </Pressable>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.brand} style={{ marginTop: spacing.lg }} />
        ) : accounts.length === 0 ? (
          <View style={styles.empty} testID="sell-empty">
            <View style={styles.emptyIcon}><Ionicons name="wallet-outline" size={40} color={colors.muted} /></View>
            <Text style={styles.emptyText}>There is currently no data</Text>
            <Pressable style={styles.addWalletBtn} onPress={() => router.push("/accounts")} testID="sell-add-wallet-button">
              <Ionicons name="add" size={18} color="#fff" />
              <Text style={styles.addWalletText}>Add Wallet</Text>
            </Pressable>
          </View>
        ) : (
          accounts.map((a) => (
            <View key={a.account_id} style={styles.walletRow} testID={`sell-wallet-${a.account_id}`}>
              <View style={styles.walletIcon}><Ionicons name="card" size={20} color={colors.brand} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.walletMethod}>{a.method}</Text>
                <Text style={styles.walletUpi} numberOfLines={1}>{a.holder_name} · {a.upi_id}</Text>
              </View>
              <Ionicons name="checkmark-circle" size={20} color={colors.success} />
            </View>
          ))
        )}

        {/* Rules */}
        <View style={styles.rulesCard}>
          <View style={styles.rulesTitleRow}>
            <Ionicons name="flash" size={16} color={colors.brand} />
            <Text style={styles.rulesTitle}>Acceleration rules</Text>
          </View>
          <Text style={styles.rulesText}>• Add a verified wallet to sell RP faster.{"\n"}• Sell requests are processed after admin approval.{"\n"}• Higher levels unlock faster payouts.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: spacing.xl, paddingBottom: spacing.md, backgroundColor: colors.surface },
  headerTitle: { color: colors.onSurface, fontFamily: fonts.bold, fontSize: 26 },
  overview: { borderRadius: radius.lg, padding: spacing.xl },
  ovLabel: { color: "#6D28D9", fontFamily: fonts.semibold, fontSize: 14 },
  ovValue: { color: "#4C1D95", fontFamily: fonts.bold, fontSize: 34, marginTop: spacing.sm },
  ovSub: { color: "#7C3AED", fontFamily: fonts.regular, fontSize: 12, marginTop: 2 },
  ovRow: { flexDirection: "row", alignItems: "center", marginTop: spacing.lg },
  ovStat: { flex: 1 },
  ovDivider: { width: 1, height: 30, backgroundColor: "rgba(124,58,237,0.25)" },
  ovStatV: { color: "#4C1D95", fontFamily: fonts.bold, fontSize: 16 },
  ovStatL: { color: "#7C3AED", fontFamily: fonts.regular, fontSize: 11, marginTop: 2 },
  actionRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.lg },
  sellBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, height: 52, borderRadius: radius.md, backgroundColor: colors.brand, ...shadow.soft },
  sellText: { color: "#fff", fontFamily: fonts.semibold, fontSize: 15 },
  recordBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, height: 52, paddingHorizontal: spacing.lg, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, borderWidth: 1.5, borderColor: colors.brand },
  recordText: { color: colors.brand, fontFamily: fonts.semibold, fontSize: 15 },
  walletHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.xl, marginBottom: spacing.md },
  sectionTitle: { color: colors.onSurface, fontFamily: fonts.bold, fontSize: 18 },
  addLink: { color: colors.brand, fontFamily: fonts.semibold, fontSize: 14 },
  empty: { alignItems: "center", backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, paddingVertical: spacing.xxl, gap: spacing.md, ...shadow.soft },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  emptyText: { color: colors.muted, fontFamily: fonts.medium, fontSize: 14 },
  addWalletBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.brand, borderRadius: radius.pill, paddingHorizontal: spacing.xl, paddingVertical: 10 },
  addWalletText: { color: "#fff", fontFamily: fonts.semibold, fontSize: 14 },
  walletRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md, ...shadow.soft },
  walletIcon: { width: 44, height: 44, borderRadius: radius.sm, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  walletMethod: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: 15 },
  walletUpi: { color: colors.onSurfaceTertiary, fontFamily: fonts.regular, fontSize: 12, marginTop: 2 },
  rulesCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, marginTop: spacing.xl, ...shadow.soft },
  rulesTitleRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: spacing.sm },
  rulesTitle: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: 15 },
  rulesText: { color: colors.onSurfaceTertiary, fontFamily: fonts.regular, fontSize: 13, lineHeight: 21 },
});
