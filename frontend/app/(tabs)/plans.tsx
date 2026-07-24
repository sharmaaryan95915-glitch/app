import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";

import { api } from "@/src/api";
import { colors, fonts, money, radius, spacing } from "@/src/theme";

export default function Tasks() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [reward, setReward] = useState<any[]>([]);
  const [daily, setDaily] = useState<any[]>([]);
  const [active, setActive] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"reward" | "daily">("reward");

  const load = useCallback(async () => {
    try {
      const [t, m] = await Promise.all([api.get("/tasks"), api.get("/plans/my")]);
      setReward(t.reward || []);
      setDaily(t.daily || []);
      setActive(m.activations || []);
    } catch {}
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const goPay = (t: any) => {
    router.push({
      pathname: "/payment/[taskId]",
      params: { taskId: t.task_id, name: t.name, amount: String(t.amount), reward: String(t.reward), code: t.code },
    });
  };

  const list = tab === "reward" ? reward : daily;

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Text style={styles.headerTitle}>Earning Tasks</Text>
        <Text style={styles.headerSub}>Pick a task, pay & earn instantly.</Text>
        <View style={styles.segment}>
          <Pressable style={[styles.segBtn, tab === "reward" && styles.segActive]} onPress={() => setTab("reward")} testID="tab-premium-plans">
            <Text style={[styles.segText, { color: tab === "reward" ? colors.onBrandPrimary : colors.onSurfaceSecondary }]}>Premium Plans</Text>
          </Pressable>
          <Pressable style={[styles.segBtn, tab === "daily" && styles.segActive]} onPress={() => setTab("daily")} testID="tab-daily-tasks">
            <Text style={[styles.segText, { color: tab === "daily" ? colors.onBrandPrimary : colors.onSurfaceSecondary }]}>Daily Tasks</Text>
          </Pressable>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.brand} style={{ marginTop: spacing.xxl }} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 110, paddingTop: spacing.lg }} showsVerticalScrollIndicator={false}>
          {active.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Your Active Tasks</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.activeRow}>
                {active.map((a) => (
                  <View key={a.activation_id} style={styles.activeCard} testID={`active-task-${a.activation_id}`}>
                    <View style={styles.activeBadge}>
                      <Ionicons name="checkmark-circle" size={13} color={colors.success} />
                      <Text style={styles.activeBadgeText}>Active</Text>
                    </View>
                    <Text style={styles.activeName}>{a.plan_name}</Text>
                    <Text style={styles.activeAmount}>{money(a.amount + a.reward)}</Text>
                    <Text style={styles.activeReward}>Profit +{money(a.reward)}</Text>
                  </View>
                ))}
              </ScrollView>
            </>
          )}

          {list.map((t, i) => {
            const pct = Math.round((t.reward / t.amount) * 100);
            const trending = t.trending;
            return (
              <Animated.View key={t.task_id} entering={FadeInDown.delay(i * 40)}>
                <Pressable
                  style={[styles.card, trending && styles.cardTrending]}
                  onPress={() => goPay(t)}
                  testID={`task-card-${t.task_id}`}
                >
                  {trending && (
                    <View style={styles.trendBanner}>
                      <Ionicons name="flame" size={12} color={colors.onBrandPrimary} />
                      <Text style={styles.trendBannerText}>{t.tag}</Text>
                    </View>
                  )}
                  <View style={styles.cardTop}>
                    <View style={{ flex: 1 }}>
                      <View style={styles.codePill}>
                        <Ionicons name="pricetag" size={10} color={colors.onBrandTertiary} />
                        <Text style={styles.codeText}>{t.code}</Text>
                      </View>
                      <Text style={styles.cardName}>{t.name}</Text>
                    </View>
                    <View style={styles.pctBox}>
                      <Text style={styles.pctValue}>+{pct}%</Text>
                      <Text style={styles.pctLabel}>return</Text>
                    </View>
                  </View>
                  <View style={styles.cardBottom}>
                    <View>
                      <Text style={styles.payLabel}>Pay</Text>
                      <Text style={styles.payAmount}>{money(t.amount)}</Text>
                    </View>
                    <Ionicons name="arrow-forward" size={18} color={colors.muted} />
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={styles.getLabel}>You get</Text>
                      <Text style={styles.getAmount}>{money(t.amount + t.reward)}</Text>
                    </View>
                  </View>
                  <View style={styles.startBtn}>
                    <Text style={styles.startText}>Start Task</Text>
                  </View>
                </Pressable>
              </Animated.View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  headerTitle: { color: colors.onSurface, fontFamily: fonts.display, fontSize: 28 },
  headerSub: { color: colors.onSurfaceTertiary, fontFamily: fonts.regular, fontSize: 14, marginTop: 2 },
  segment: { flexDirection: "row", backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: 4, gap: 4, marginTop: spacing.lg, borderWidth: 1, borderColor: colors.border },
  segBtn: { flex: 1, height: 40, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  segActive: { backgroundColor: colors.brand },
  segText: { fontFamily: fonts.medium, fontSize: 13 },
  sectionTitle: { color: colors.onSurface, fontFamily: fonts.displaySemi, fontSize: 18, paddingHorizontal: spacing.xl, marginBottom: spacing.md },
  activeRow: { paddingHorizontal: spacing.xl, gap: spacing.md, marginBottom: spacing.lg },
  activeCard: { width: 180, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.brandTertiary, padding: spacing.lg },
  activeBadge: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: spacing.sm },
  activeBadgeText: { color: colors.success, fontFamily: fonts.medium, fontSize: 12 },
  activeName: { color: colors.onSurfaceTertiary, fontFamily: fonts.medium, fontSize: 13 },
  activeAmount: { color: colors.onSurface, fontFamily: fonts.display, fontSize: 24, marginTop: 2 },
  activeReward: { color: colors.success, fontFamily: fonts.medium, fontSize: 13, marginTop: spacing.sm },
  card: {
    marginHorizontal: spacing.xl,
    marginBottom: spacing.lg,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    overflow: "hidden",
  },
  cardTrending: { borderColor: colors.brand, borderWidth: 2, backgroundColor: "#1c1809" },
  trendBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    backgroundColor: colors.brand,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    marginBottom: spacing.md,
  },
  trendBannerText: { color: colors.onBrandPrimary, fontFamily: fonts.semibold, fontSize: 10, letterSpacing: 0.5 },
  cardTop: { flexDirection: "row", alignItems: "flex-start" },
  codePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    backgroundColor: colors.brandTertiary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    marginBottom: spacing.sm,
  },
  codeText: { color: colors.onBrandTertiary, fontFamily: fonts.medium, fontSize: 11, letterSpacing: 1 },
  cardName: { color: colors.onSurface, fontFamily: fonts.displaySemi, fontSize: 20 },
  pctBox: { alignItems: "center" },
  pctValue: { color: colors.success, fontFamily: fonts.display, fontSize: 22 },
  pctLabel: { color: colors.muted, fontFamily: fonts.regular, fontSize: 11 },
  cardBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.lg },
  payLabel: { color: colors.muted, fontFamily: fonts.regular, fontSize: 12 },
  payAmount: { color: colors.onSurface, fontFamily: fonts.displaySemi, fontSize: 20 },
  getLabel: { color: colors.muted, fontFamily: fonts.regular, fontSize: 12 },
  getAmount: { color: colors.brand, fontFamily: fonts.displaySemi, fontSize: 20 },
  startBtn: { backgroundColor: colors.brand, borderRadius: radius.md, height: 46, alignItems: "center", justifyContent: "center", marginTop: spacing.lg },
  startText: { color: colors.onBrandPrimary, fontFamily: fonts.semibold, fontSize: 15 },
});
