import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "@/src/context/AuthContext";
import { api } from "@/src/api";
import { colors, fonts, IMAGES, money, radius, spacing } from "@/src/theme";
import { TxRow } from "@/src/components/TxRow";

const QUICK = [
  { icon: "arrow-up-circle", label: "Withdraw", route: "/wallet/withdraw" },
  { icon: "card", label: "Accounts", route: "/accounts" },
  { icon: "help-buoy", label: "Help", route: "/help" },
];

function compact(n: number) {
  if (n >= 10000000) return "₹" + (n / 10000000).toFixed(2) + "Cr";
  if (n >= 100000) return "₹" + (n / 100000).toFixed(1) + "L";
  return money(n);
}

export default function Home() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [txs, setTxs] = useState<any[]>([]);
  const [planCount, setPlanCount] = useState(0);
  const [refCount, setRefCount] = useState(0);
  const [stats, setStats] = useState<any>(null);
  const [tickIdx, setTickIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [t, p, r, s] = await Promise.all([
        api.get("/wallet/transactions"),
        api.get("/plans/my"),
        api.get("/referrals"),
        api.get("/stats/live"),
      ]);
      setTxs(t.transactions || []);
      setPlanCount((p.activations || []).length);
      setRefCount(r.count || 0);
      setStats(s);
      await refreshUser();
    } catch {}
    setLoading(false);
  }, [refreshUser]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // live ticker + stats refresh
  useEffect(() => {
    const tick = setInterval(() => setTickIdx((i) => i + 1), 2600);
    const poll = setInterval(async () => {
      try { const s = await api.get("/stats/live"); setStats(s); } catch {}
    }, 15000);
    return () => { clearInterval(tick); clearInterval(poll); };
  }, []);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const recent = stats?.recent_withdrawals || [];
  const current = recent.length ? recent[tickIdx % recent.length] : null;

  const quickStats = [
    { label: "Total Earned", value: money(user?.total_earned), icon: "trending-up" },
    { label: "Active Tasks", value: String(planCount), icon: "layers" },
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

        {/* Live payouts ticker */}
        {current && (
          <View style={styles.ticker} testID="live-ticker">
            <View style={styles.liveDot} />
            <Text style={styles.liveLabel}>LIVE</Text>
            <Animated.Text key={tickIdx} entering={FadeIn.duration(400)} style={styles.tickerText} numberOfLines={1}>
              {current.name} withdrew {money(current.amount)} · {current.ago}s ago
            </Animated.Text>
          </View>
        )}

        {/* Balance hero card */}
        <View style={styles.heroCard} testID="balance-card">
          <Image source={{ uri: IMAGES.heroBg }} style={StyleSheet.absoluteFill} contentFit="cover" />
          <LinearGradient colors={["rgba(18,18,18,0.55)", "rgba(18,18,18,0.9)"]} style={StyleSheet.absoluteFill} />
          <View style={styles.heroInner}>
            <View style={styles.heroTop}>
              <Text style={styles.heroLabel}>Total Balance</Text>
              <Text style={styles.heroBrand}>VICTORY PAY</Text>
            </View>
            <Text style={styles.heroBalance} testID="balance-amount">{money(user?.balance)}</Text>
            <View style={styles.heroBottom}>
              <Text style={styles.cardNumber}>•••• •••• •••• {(user?.user_id || "0000").slice(-4)}</Text>
              <View style={styles.premiumPill}><Text style={styles.premiumText}>PREMIUM</Text></View>
            </View>
          </View>
        </View>

        {/* Primary action */}
        <Pressable style={styles.startBtn} onPress={() => router.push("/(tabs)/plans")} testID="home-start-earning">
          <Ionicons name="rocket" size={20} color={colors.onBrandPrimary} />
          <Text style={styles.startText}>Start Earning — View Tasks</Text>
        </Pressable>

        {/* Quick actions */}
        <View style={styles.quickRow}>
          {QUICK.map((q) => (
            <Pressable key={q.label} style={styles.quickBtn} onPress={() => router.push(q.route as any)} testID={`home-quick-${q.label}`}>
              <View style={styles.quickIcon}><Ionicons name={q.icon as any} size={20} color={colors.brand} /></View>
              <Text style={styles.quickLabel}>{q.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* Live platform stats */}
        {stats && (
          <Animated.View entering={FadeInDown} style={styles.statsBanner} testID="live-stats">
            <View style={styles.statCol}>
              <Text style={styles.statNum}>{(stats.active_earners || 0).toLocaleString("en-IN")}</Text>
              <Text style={styles.statCap}>Active earners</Text>
            </View>
            <View style={styles.statDiv} />
            <View style={styles.statCol}>
              <Text style={styles.statNum}>{compact(stats.total_withdrawn || 0)}</Text>
              <Text style={styles.statCap}>Paid out</Text>
            </View>
            <View style={styles.statDiv} />
            <View style={styles.statCol}>
              <Text style={styles.statNum}>{(stats.payouts_today || 0).toLocaleString("en-IN")}</Text>
              <Text style={styles.statCap}>Payouts today</Text>
            </View>
          </Animated.View>
        )}

        {/* My quick stats */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.myStatsRow}>
          {quickStats.map((s) => (
            <View key={s.label} style={styles.myStatCard}>
              <View style={styles.myStatIcon}><Ionicons name={s.icon as any} size={18} color={colors.brand} /></View>
              <Text style={styles.myStatValue}>{s.value}</Text>
              <Text style={styles.myStatLabel}>{s.label}</Text>
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
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing.xl, marginBottom: spacing.md },
  hi: { color: colors.onSurfaceTertiary, fontFamily: fonts.regular, fontSize: 13 },
  name: { color: colors.onSurface, fontFamily: fonts.displaySemi, fontSize: 22, marginTop: 2 },
  avatar: { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: colors.brandTertiary, borderWidth: 1, borderColor: colors.brand, alignItems: "center", justifyContent: "center" },
  avatarText: { color: colors.brand, fontFamily: fonts.semibold, fontSize: 18 },
  ticker: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginHorizontal: spacing.xl, marginBottom: spacing.md, backgroundColor: "rgba(5,150,105,0.10)", borderColor: "rgba(5,150,105,0.4)", borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.success },
  liveLabel: { color: colors.success, fontFamily: fonts.semibold, fontSize: 10, letterSpacing: 1 },
  tickerText: { flex: 1, color: colors.onSurfaceSecondary, fontFamily: fonts.medium, fontSize: 12 },
  heroCard: { marginHorizontal: spacing.xl, height: 200, borderRadius: radius.lg, overflow: "hidden", borderWidth: 1, borderColor: colors.borderStrong },
  heroInner: { flex: 1, padding: spacing.xl, justifyContent: "space-between" },
  heroTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  heroLabel: { color: colors.onSurfaceSecondary, fontFamily: fonts.medium, fontSize: 13 },
  heroBrand: { color: colors.brand, fontFamily: fonts.semibold, fontSize: 12, letterSpacing: 1 },
  heroBalance: { color: colors.onSurface, fontFamily: fonts.display, fontSize: 42 },
  heroBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardNumber: { color: colors.onSurfaceSecondary, fontFamily: fonts.medium, fontSize: 15, letterSpacing: 2 },
  premiumPill: { backgroundColor: colors.brand, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  premiumText: { color: colors.onBrandPrimary, fontFamily: fonts.semibold, fontSize: 9, letterSpacing: 1 },
  startBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, marginHorizontal: spacing.xl, marginTop: spacing.lg, height: 54, borderRadius: radius.md, backgroundColor: colors.brand },
  startText: { color: colors.onBrandPrimary, fontFamily: fonts.semibold, fontSize: 16 },
  quickRow: { flexDirection: "row", gap: spacing.md, paddingHorizontal: spacing.xl, marginTop: spacing.md },
  quickBtn: { flex: 1, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingVertical: spacing.md, alignItems: "center", gap: spacing.xs },
  quickIcon: { width: 40, height: 40, borderRadius: radius.sm, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  quickLabel: { color: colors.onSurfaceSecondary, fontFamily: fonts.medium, fontSize: 12 },
  statsBanner: { flexDirection: "row", alignItems: "center", marginHorizontal: spacing.xl, marginTop: spacing.lg, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingVertical: spacing.lg },
  statCol: { flex: 1, alignItems: "center" },
  statDiv: { width: 1, height: 30, backgroundColor: colors.border },
  statNum: { color: colors.brand, fontFamily: fonts.displaySemi, fontSize: 17 },
  statCap: { color: colors.muted, fontFamily: fonts.regular, fontSize: 10, marginTop: 3 },
  myStatsRow: { paddingHorizontal: spacing.xl, gap: spacing.md, marginTop: spacing.xl },
  myStatCard: { width: 130, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.lg },
  myStatIcon: { width: 36, height: 36, borderRadius: radius.sm, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center", marginBottom: spacing.sm },
  myStatValue: { color: colors.onSurface, fontFamily: fonts.displaySemi, fontSize: 20 },
  myStatLabel: { color: colors.onSurfaceTertiary, fontFamily: fonts.regular, fontSize: 12, marginTop: 2 },
  txHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing.xl, marginTop: spacing.xl, marginBottom: spacing.md },
  sectionTitle: { color: colors.onSurface, fontFamily: fonts.displaySemi, fontSize: 18 },
  viewAll: { color: colors.brand, fontFamily: fonts.medium, fontSize: 13 },
  empty: { color: colors.muted, fontFamily: fonts.regular, fontSize: 14, textAlign: "center", marginTop: spacing.xl },
});
