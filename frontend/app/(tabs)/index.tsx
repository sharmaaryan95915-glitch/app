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
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "@/src/context/AuthContext";
import { api } from "@/src/api";
import { colors, fonts, IMAGES, money, radius, spacing } from "@/src/theme";
import { TxRow } from "@/src/components/TxRow";

export default function Home() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [txs, setTxs] = useState<any[]>([]);
  const [planCount, setPlanCount] = useState(0);
  const [refCount, setRefCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [t, p, r] = await Promise.all([
        api.get("/wallet/transactions"),
        api.get("/plans/my"),
        api.get("/referrals"),
      ]);
      setTxs(t.transactions || []);
      setPlanCount((p.activations || []).length);
      setRefCount(r.count || 0);
      await refreshUser();
    } catch {}
    setLoading(false);
  }, [refreshUser]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const stats = [
    { label: "Total Earned", value: money(user?.total_earned), icon: "trending-up" },
    { label: "Active Plans", value: String(planCount), icon: "layers" },
    { label: "Referrals", value: String(refCount), icon: "people" },
  ];

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.hi}>Welcome back</Text>
            <Text style={styles.name} testID="home-user-name">{user?.name}</Text>
          </View>
          <Pressable style={styles.avatar} onPress={() => router.push("/(tabs)/profile")} testID="home-profile-button">
            <Text style={styles.avatarText}>{user?.name?.[0]?.toUpperCase() || "V"}</Text>
          </Pressable>
        </View>

        {/* Balance hero card */}
        <View style={styles.heroCard} testID="balance-card">
          <Image source={{ uri: IMAGES.heroBg }} style={StyleSheet.absoluteFill} contentFit="cover" />
          <LinearGradient
            colors={["rgba(18,18,18,0.55)", "rgba(18,18,18,0.9)"]}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.heroInner}>
            <View style={styles.heroTop}>
              <Text style={styles.heroLabel}>Total Balance</Text>
              <Text style={styles.heroBrand}>VICTORY PAY</Text>
            </View>
            <Text style={styles.heroBalance} testID="balance-amount">{money(user?.balance)}</Text>
            <View style={styles.heroBottom}>
              <Text style={styles.cardNumber}>•••• •••• •••• {(user?.user_id || "0000").slice(-4)}</Text>
              <View style={styles.premiumPill}>
                <Text style={styles.premiumText}>PREMIUM</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <Pressable style={[styles.actionBtn, styles.actionPrimary]} onPress={() => router.push("/wallet/deposit")} testID="home-deposit-button">
            <Ionicons name="arrow-down" size={20} color={colors.onBrandPrimary} />
            <Text style={[styles.actionText, { color: colors.onBrandPrimary }]}>Deposit</Text>
          </Pressable>
          <Pressable style={[styles.actionBtn, styles.actionOutline]} onPress={() => router.push("/wallet/withdraw")} testID="home-withdraw-button">
            <Ionicons name="arrow-up" size={20} color={colors.brand} />
            <Text style={[styles.actionText, { color: colors.brand }]}>Withdraw</Text>
          </Pressable>
        </View>

        {/* Quick stats */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.statsRow}
        >
          {stats.map((s) => (
            <View key={s.label} style={styles.statCard}>
              <View style={styles.statIcon}>
                <Ionicons name={s.icon as any} size={18} color={colors.brand} />
              </View>
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </ScrollView>

        {/* Recent transactions */}
        <View style={styles.txHeader}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <Pressable onPress={() => router.push("/wallet/history")} testID="home-view-all-button">
            <Text style={styles.viewAll}>View all</Text>
          </Pressable>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.brand} style={{ marginTop: spacing.xl }} />
        ) : txs.length === 0 ? (
          <Text style={styles.empty}>No transactions yet.</Text>
        ) : (
          txs.slice(0, 6).map((tx, i) => (
            <Animated.View key={tx.tx_id} entering={FadeInDown.delay(i * 50)}>
              <TxRow tx={tx} />
            </Animated.View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.lg,
  },
  hi: { color: colors.onSurfaceTertiary, fontFamily: fonts.regular, fontSize: 13 },
  name: { color: colors.onSurface, fontFamily: fonts.displaySemi, fontSize: 22, marginTop: 2 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.brandTertiary,
    borderWidth: 1,
    borderColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: colors.brand, fontFamily: fonts.semibold, fontSize: 18 },
  heroCard: {
    marginHorizontal: spacing.xl,
    height: 200,
    borderRadius: radius.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  heroInner: { flex: 1, padding: spacing.xl, justifyContent: "space-between" },
  heroTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  heroLabel: { color: colors.onSurfaceSecondary, fontFamily: fonts.medium, fontSize: 13 },
  heroBrand: { color: colors.brand, fontFamily: fonts.semibold, fontSize: 12, letterSpacing: 1 },
  heroBalance: { color: colors.onSurface, fontFamily: fonts.display, fontSize: 42 },
  heroBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardNumber: { color: colors.onSurfaceSecondary, fontFamily: fonts.medium, fontSize: 15, letterSpacing: 2 },
  premiumPill: {
    backgroundColor: colors.brand,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  premiumText: { color: colors.onBrandPrimary, fontFamily: fonts.semibold, fontSize: 9, letterSpacing: 1 },
  actions: { flexDirection: "row", gap: spacing.md, paddingHorizontal: spacing.xl, marginTop: spacing.lg },
  actionBtn: {
    flex: 1,
    height: 52,
    borderRadius: radius.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  actionPrimary: { backgroundColor: colors.brand },
  actionOutline: { borderWidth: 1, borderColor: colors.brand, backgroundColor: colors.surfaceSecondary },
  actionText: { fontFamily: fonts.semibold, fontSize: 15 },
  statsRow: { paddingHorizontal: spacing.xl, gap: spacing.md, marginTop: spacing.xl },
  statCard: {
    width: 130,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  statValue: { color: colors.onSurface, fontFamily: fonts.displaySemi, fontSize: 20 },
  statLabel: { color: colors.onSurfaceTertiary, fontFamily: fonts.regular, fontSize: 12, marginTop: 2 },
  txHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  sectionTitle: { color: colors.onSurface, fontFamily: fonts.displaySemi, fontSize: 18 },
  viewAll: { color: colors.brand, fontFamily: fonts.medium, fontSize: 13 },
  empty: { color: colors.muted, fontFamily: fonts.regular, fontSize: 14, textAlign: "center", marginTop: spacing.xl },
});
