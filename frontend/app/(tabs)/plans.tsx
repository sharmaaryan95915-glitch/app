import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "@/src/context/AuthContext";
import { api } from "@/src/api";
import { useToast } from "@/src/components/Toast";
import { colors, fonts, money, radius, spacing } from "@/src/theme";

export default function Plans() {
  const { refreshUser } = useAuth();
  const toast = useToast();
  const insets = useSafeAreaInsets();

  const [plans, setPlans] = useState<any[]>([]);
  const [active, setActive] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [p, m] = await Promise.all([api.get("/plans"), api.get("/plans/my")]);
      setPlans(p.plans || []);
      setActive(m.activations || []);
    } catch {}
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const activate = async (plan: any) => {
    setActivating(plan.plan_id);
    try {
      await api.post("/plans/activate", { plan_id: plan.plan_id });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.show(`${plan.name} activated! +${money(plan.reward)} reward`, "success");
      await Promise.all([load(), refreshUser()]);
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      toast.show(e.message || "Activation failed", "error");
    } finally {
      setActivating(null);
    }
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Text style={styles.headerTitle}>Reward Plans</Text>
        <Text style={styles.headerSub}>Activate a plan and earn 4% instantly.</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.brand} style={{ marginTop: spacing.xxl }} />
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        >
          {active.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Active Plans</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.activeRow}
              >
                {active.map((a) => (
                  <View key={a.activation_id} style={styles.activeCard} testID={`active-plan-${a.activation_id}`}>
                    <View style={styles.activeBadge}>
                      <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                      <Text style={styles.activeBadgeText}>Active</Text>
                    </View>
                    <Text style={styles.activePlanName}>{a.plan_name}</Text>
                    <Text style={styles.activeAmount}>{money(a.amount)}</Text>
                    <Text style={styles.activeReward}>Reward earned +{money(a.reward)}</Text>
                  </View>
                ))}
              </ScrollView>
            </>
          )}

          <Text style={styles.sectionTitle}>Available Plans</Text>
          {plans.map((p, i) => (
            <Animated.View key={p.plan_id} entering={FadeInDown.delay(i * 60)} style={styles.planCard} testID={`plan-card-${p.plan_id}`}>
              <View style={styles.planTop}>
                <View>
                  <View style={styles.tagPill}>
                    <Text style={styles.tagText}>{p.tag}</Text>
                  </View>
                  <Text style={styles.planName}>{p.name}</Text>
                </View>
                <View style={styles.rewardBox}>
                  <Text style={styles.rewardRate}>4%</Text>
                  <Text style={styles.rewardLabel}>reward</Text>
                </View>
              </View>
              <View style={styles.planDivider} />
              <View style={styles.planBottom}>
                <View>
                  <Text style={styles.planAmountLabel}>Plan amount</Text>
                  <Text style={styles.planAmount}>{money(p.amount)}</Text>
                  <Text style={styles.planEarn}>Earn {money(p.reward)}</Text>
                </View>
                <Pressable
                  style={[styles.activateBtn, activating === p.plan_id && { opacity: 0.6 }]}
                  onPress={() => activate(p)}
                  disabled={!!activating}
                  testID={`activate-plan-${p.plan_id}`}
                >
                  {activating === p.plan_id ? (
                    <ActivityIndicator color={colors.brand} size="small" />
                  ) : (
                    <Text style={styles.activateText}>Activate</Text>
                  )}
                </Pressable>
              </View>
            </Animated.View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  headerTitle: { color: colors.onSurface, fontFamily: fonts.display, fontSize: 28 },
  headerSub: { color: colors.onSurfaceTertiary, fontFamily: fonts.regular, fontSize: 14, marginTop: 2 },
  sectionTitle: {
    color: colors.onSurface,
    fontFamily: fonts.displaySemi,
    fontSize: 18,
    paddingHorizontal: spacing.xl,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  activeRow: { paddingHorizontal: spacing.xl, gap: spacing.md },
  activeCard: {
    width: 200,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.brandTertiary,
    padding: spacing.lg,
  },
  activeBadge: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: spacing.md },
  activeBadgeText: { color: colors.success, fontFamily: fonts.medium, fontSize: 12 },
  activePlanName: { color: colors.onSurfaceTertiary, fontFamily: fonts.medium, fontSize: 13 },
  activeAmount: { color: colors.onSurface, fontFamily: fonts.display, fontSize: 26, marginTop: 2 },
  activeReward: { color: colors.success, fontFamily: fonts.medium, fontSize: 13, marginTop: spacing.sm },
  planCard: {
    marginHorizontal: spacing.xl,
    marginBottom: spacing.lg,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
  },
  planTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  tagPill: {
    alignSelf: "flex-start",
    backgroundColor: colors.brandTertiary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    marginBottom: spacing.sm,
  },
  tagText: { color: colors.onBrandTertiary, fontFamily: fonts.medium, fontSize: 10, letterSpacing: 0.5 },
  planName: { color: colors.onSurface, fontFamily: fonts.displaySemi, fontSize: 20 },
  rewardBox: { alignItems: "center" },
  rewardRate: { color: colors.brand, fontFamily: fonts.display, fontSize: 24 },
  rewardLabel: { color: colors.muted, fontFamily: fonts.regular, fontSize: 11 },
  planDivider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.lg },
  planBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  planAmountLabel: { color: colors.muted, fontFamily: fonts.regular, fontSize: 12 },
  planAmount: { color: colors.onSurface, fontFamily: fonts.display, fontSize: 26 },
  planEarn: { color: colors.success, fontFamily: fonts.medium, fontSize: 13, marginTop: 2 },
  activateBtn: {
    backgroundColor: colors.brand,
    borderRadius: radius.md,
    paddingHorizontal: spacing.xl,
    height: 46,
    minWidth: 110,
    alignItems: "center",
    justifyContent: "center",
  },
  activateText: { color: colors.onBrandPrimary, fontFamily: fonts.semibold, fontSize: 15 },
});
