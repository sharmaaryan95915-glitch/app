import { useCallback, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "@/src/context/AuthContext";
import { api } from "@/src/api";
import { colors, fonts, money, radius, shadow, spacing } from "@/src/theme";

export default function Home() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [buyQty, setBuyQty] = useState(0);
  const [buyAmt, setBuyAmt] = useState(0);
  const [soldToday, setSoldToday] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [p, t] = await Promise.all([api.get("/plans/my"), api.get("/wallet/transactions")]);
      const acts = p.activations || [];
      setBuyQty(acts.length);
      setBuyAmt(acts.reduce((s: number, a: any) => s + (a.amount || 0), 0));
      const wd = (t.transactions || []).filter((x: any) => x.type === "withdraw");
      setSoldToday(wd.reduce((s: number, x: any) => s + Math.abs(x.amount), 0));
      await refreshUser();
    } catch {}
  }, [refreshUser]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const stats = [
    { icon: "cart", label: "Buy quantity", value: String(buyQty) },
    { icon: "cash", label: "Buy Amount", value: money(buyAmt) },
    { icon: "swap-horizontal", label: "Sell today", value: money(soldToday) },
    { icon: "pie-chart", label: "Total revenue", value: money(user?.total_earned) },
  ];

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
      >
        {/* top brand bar */}
        <LinearGradient colors={[colors.brand, colors.brandSecondary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.topBar, { paddingTop: insets.top + spacing.md }]}>
          <View style={styles.brandRow}>
            <View style={styles.logoBox}><Text style={styles.logoV}>V</Text></View>
            <Text style={styles.brandName}>Victory Pay</Text>
            <Pressable style={styles.bell} onPress={() => router.push("/help")} testID="home-help-button">
              <Ionicons name="headset" size={18} color="#fff" />
            </Pressable>
          </View>
          <Text style={styles.balHint}>Available Balance</Text>
          <Text style={styles.balValue} testID="home-balance">{money(user?.balance)}</Text>
        </LinearGradient>

        <View style={styles.body}>
          {/* Daily rewards banner */}
          <Animated.View entering={FadeInDown}>
            <Pressable onPress={() => router.push("/(tabs)/plans")} testID="daily-rewards-banner">
              <LinearGradient colors={["#F5A623", "#E8620B"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.rewardBanner}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rewardTag}>DAILY REWARDS</Text>
                  <Text style={styles.rewardTitle}>Earn rewards every day!</Text>
                  <View style={styles.claimBtn}><Text style={styles.claimText}>Claim Daily Bonus</Text><Ionicons name="chevron-forward" size={13} color="#E8620B" /></View>
                </View>
                <Ionicons name="gift" size={54} color="rgba(255,255,255,0.9)" />
              </LinearGradient>
            </Pressable>
          </Animated.View>

          {/* USDT top-up */}
          <Animated.View entering={FadeInDown.delay(60)}>
            <Pressable onPress={() => router.push("/(tabs)/plans")} testID="usdt-topup-banner">
              <LinearGradient colors={["#E3F5EC", "#D2F0E2"]} style={styles.usdtBanner}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.usdtTitle}><Text style={{ color: colors.brand }}>USDT</Text> Top-up</Text>
                  <Text style={styles.usdtSub}>Safe · Fast · Convenient</Text>
                  <View style={styles.topupBtn}><Text style={styles.topupText}>Top up</Text><Ionicons name="arrow-forward" size={12} color="#fff" /></View>
                </View>
                <View style={styles.usdtCoin}><Text style={styles.usdtCoinT}>$</Text></View>
              </LinearGradient>
            </Pressable>
          </Animated.View>

          {/* Deposit USDT dark banner */}
          <Animated.View entering={FadeInDown.delay(120)}>
            <Pressable onPress={() => router.push("/(tabs)/plans")} testID="deposit-usdt-banner">
              <LinearGradient colors={["#0F2A24", "#0B3D30"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.depositBanner}>
                <Text style={styles.depositText}>Deposit <Text style={{ color: colors.brand }}>USDT</Text> &{"\n"}Get Extra Bonus</Text>
                <View style={styles.enterBtn}><Text style={styles.enterText}>Click to enter</Text></View>
              </LinearGradient>
            </Pressable>
          </Animated.View>

          {/* Stats card */}
          <Animated.View entering={FadeInDown.delay(160)} style={styles.statsCard}>
            <View style={styles.statsGrid}>
              {stats.map((s) => (
                <View key={s.label} style={styles.statCell}>
                  <View style={styles.statLabelRow}>
                    <Ionicons name={s.icon as any} size={16} color={colors.onSurface} />
                    <Text style={styles.statLabel}>{s.label}</Text>
                  </View>
                  <Text style={styles.statValue}>{s.value}</Text>
                </View>
              ))}
            </View>
            <Pressable style={styles.moreRow} onPress={() => router.push("/wallet/history")} testID="home-more-button">
              <Text style={styles.moreText}>More</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.onSurfaceTertiary} />
            </Pressable>
          </Animated.View>

          {/* Tutorial */}
          <Text style={styles.sectionTitle}>Tutorial</Text>
          <View style={styles.tutorialCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.tutTitle}>Purchase Introduction</Text>
              <Text style={styles.tutSub}>Learn how to buy RP, complete a task and earn rewards instantly.</Text>
              <Pressable style={styles.tutBtn} onPress={() => router.push("/help")} testID="tutorial-button">
                <Text style={styles.tutBtnText}>Read guide</Text>
              </Pressable>
            </View>
            <View style={styles.tutIcon}><Ionicons name="book" size={30} color={colors.brand} /></View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  topBar: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  logoBox: { width: 34, height: 34, borderRadius: 10, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  logoV: { color: colors.brand, fontFamily: fonts.bold, fontSize: 20 },
  brandName: { flex: 1, color: "#fff", fontFamily: fonts.bold, fontSize: 18 },
  bell: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  balHint: { color: "rgba(255,255,255,0.85)", fontFamily: fonts.regular, fontSize: 13, marginTop: spacing.lg },
  balValue: { color: "#fff", fontFamily: fonts.bold, fontSize: 34, marginTop: 2 },
  body: { paddingHorizontal: spacing.lg, marginTop: spacing.lg, gap: spacing.md },
  rewardBanner: { flexDirection: "row", alignItems: "center", borderRadius: radius.lg, padding: spacing.lg, ...shadow.soft },
  rewardTag: { color: "#fff", fontFamily: fonts.bold, fontSize: 20, letterSpacing: 0.5 },
  rewardTitle: { color: "rgba(255,255,255,0.95)", fontFamily: fonts.medium, fontSize: 13, marginTop: 2 },
  claimBtn: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", backgroundColor: "#fff", borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 6, marginTop: spacing.md },
  claimText: { color: "#E8620B", fontFamily: fonts.semibold, fontSize: 12 },
  usdtBanner: { flexDirection: "row", alignItems: "center", borderRadius: radius.lg, padding: spacing.lg },
  usdtTitle: { color: colors.onSurface, fontFamily: fonts.bold, fontSize: 22 },
  usdtSub: { color: colors.onSurfaceSecondary, fontFamily: fonts.medium, fontSize: 13, marginTop: 2 },
  topupBtn: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", backgroundColor: colors.brand, borderRadius: radius.pill, paddingHorizontal: spacing.lg, paddingVertical: 7, marginTop: spacing.md },
  topupText: { color: "#fff", fontFamily: fonts.semibold, fontSize: 13 },
  usdtCoin: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  usdtCoinT: { color: "#fff", fontFamily: fonts.bold, fontSize: 30 },
  depositBanner: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: radius.lg, padding: spacing.lg },
  depositText: { color: "#fff", fontFamily: fonts.bold, fontSize: 18, lineHeight: 24 },
  enterBtn: { backgroundColor: colors.brand, borderRadius: radius.pill, paddingHorizontal: spacing.lg, paddingVertical: 8 },
  enterText: { color: "#fff", fontFamily: fonts.semibold, fontSize: 12 },
  statsCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, ...shadow.card },
  statsGrid: { flexDirection: "row", flexWrap: "wrap" },
  statCell: { width: "50%", paddingVertical: spacing.md },
  statLabelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  statLabel: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: 14 },
  statValue: { color: colors.onSurfaceTertiary, fontFamily: fonts.medium, fontSize: 18, marginTop: 6 },
  moreRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.divider, marginTop: spacing.sm },
  moreText: { color: colors.onSurfaceTertiary, fontFamily: fonts.medium, fontSize: 13 },
  sectionTitle: { color: colors.onSurface, fontFamily: fonts.bold, fontSize: 22, marginTop: spacing.md },
  tutorialCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, ...shadow.card },
  tutTitle: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: 16 },
  tutSub: { color: colors.onSurfaceTertiary, fontFamily: fonts.regular, fontSize: 12, marginTop: 4, lineHeight: 17 },
  tutBtn: { alignSelf: "flex-start", backgroundColor: colors.brandTertiary, borderRadius: radius.pill, paddingHorizontal: spacing.lg, paddingVertical: 7, marginTop: spacing.md },
  tutBtnText: { color: colors.onBrandTertiary, fontFamily: fonts.semibold, fontSize: 12 },
  tutIcon: { width: 60, height: 60, borderRadius: radius.md, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
});
