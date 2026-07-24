import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { api } from "@/src/api";
import { useToast } from "@/src/components/Toast";
import { colors, fonts, money, radius, spacing } from "@/src/theme";

export default function Referrals() {
  const toast = useToast();
  const insets = useSafeAreaInsets();

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api.get("/referrals");
      setData(r);
    } catch {}
    setLoading(false);
  }, []);

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

  const copyCode = async () => {
    if (!data?.referral_code) return;
    await Clipboard.setStringAsync(data.referral_code);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    toast.show("Referral code copied!", "success");
  };

  const shareCode = async () => {
    if (!data?.referral_code) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Share.share({
      message: `Join me on Victory Pay and get ₹70 welcome bonus! Use my referral code ${data.referral_code} when you sign up. 🏆`,
    });
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color={colors.brand} size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingBottom: 100 }}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
    >
      <Text style={styles.title}>Referrals</Text>

      <View style={styles.hero}>
        <LinearGradient colors={[colors.brandTertiary, colors.surfaceSecondary]} style={StyleSheet.absoluteFill} />
        <Text style={styles.heroLabel}>Total Referral Earnings</Text>
        <Text style={styles.heroAmount} testID="referral-total-earned">{money(data?.total_earned)}</Text>
        <View style={styles.heroStats}>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatValue}>{data?.count ?? 0}</Text>
            <Text style={styles.heroStatLabel}>Invited</Text>
          </View>
          <View style={styles.heroStatDivider} />
          <View style={styles.heroStat}>
            <Text style={styles.heroStatValue}>{money(data?.reward_per_referral)}</Text>
            <Text style={styles.heroStatLabel}>Per referral</Text>
          </View>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Your Referral Code</Text>
      <View style={styles.codeBox}>
        <View style={{ flex: 1 }}>
          <Text style={styles.codeLabel}>Share & earn ₹300 each</Text>
          <Text style={styles.code} testID="referral-code">{data?.referral_code}</Text>
        </View>
        <Pressable style={styles.copyBtn} onPress={copyCode} testID="copy-referral-button">
          <Ionicons name="copy-outline" size={20} color={colors.brand} />
        </Pressable>
      </View>

      <Pressable style={styles.shareBtn} onPress={shareCode} testID="share-referral-button">
        <Ionicons name="share-social" size={18} color={colors.onBrandPrimary} />
        <Text style={styles.shareText}>Share invite link</Text>
      </Pressable>

      <Text style={styles.sectionTitle}>Invited Friends</Text>
      {(!data?.invited || data.invited.length === 0) ? (
        <View style={styles.empty} testID="referral-empty">
          <Ionicons name="people-outline" size={40} color={colors.muted} />
          <Text style={styles.emptyText}>Invite your first friend to start earning.</Text>
        </View>
      ) : (
        data.invited.map((f: any, i: number) => (
          <View key={i} style={styles.friendRow} testID={`friend-row-${i}`}>
            <View style={styles.friendAvatar}>
              <Text style={styles.friendInitial}>{f.name?.[0]?.toUpperCase() || "?"}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.friendName}>{f.name}</Text>
              <Text style={styles.friendEmail} numberOfLines={1}>{f.email}</Text>
            </View>
            <View style={styles.earnedPill}>
              <Text style={styles.earnedText}>+{money(data.reward_per_referral)}</Text>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  loader: { flex: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  title: { color: colors.onSurface, fontFamily: fonts.display, fontSize: 28, paddingHorizontal: spacing.xl },
  hero: {
    marginHorizontal: spacing.xl,
    marginTop: spacing.lg,
    borderRadius: radius.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.brandTertiary,
    padding: spacing.xl,
  },
  heroLabel: { color: colors.onSurfaceSecondary, fontFamily: fonts.medium, fontSize: 13 },
  heroAmount: { color: colors.brand, fontFamily: fonts.display, fontSize: 40, marginTop: spacing.xs },
  heroStats: { flexDirection: "row", alignItems: "center", marginTop: spacing.lg },
  heroStat: { flex: 1 },
  heroStatDivider: { width: 1, height: 32, backgroundColor: colors.borderStrong },
  heroStatValue: { color: colors.onSurface, fontFamily: fonts.displaySemi, fontSize: 18 },
  heroStatLabel: { color: colors.onSurfaceTertiary, fontFamily: fonts.regular, fontSize: 12, marginTop: 2 },
  sectionTitle: {
    color: colors.onSurface,
    fontFamily: fonts.displaySemi,
    fontSize: 18,
    paddingHorizontal: spacing.xl,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  codeBox: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: spacing.xl,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    padding: spacing.lg,
  },
  codeLabel: { color: colors.onSurfaceTertiary, fontFamily: fonts.regular, fontSize: 12 },
  code: { color: colors.brand, fontFamily: fonts.display, fontSize: 24, letterSpacing: 2, marginTop: 2 },
  copyBtn: {
    width: 46,
    height: 46,
    borderRadius: radius.sm,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    marginHorizontal: spacing.xl,
    marginTop: spacing.md,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.brand,
  },
  shareText: { color: colors.onBrandPrimary, fontFamily: fonts.semibold, fontSize: 15 },
  empty: { alignItems: "center", paddingVertical: spacing.xxl, gap: spacing.md },
  emptyText: { color: colors.muted, fontFamily: fonts.regular, fontSize: 14 },
  friendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginHorizontal: spacing.xl,
    marginBottom: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  friendAvatar: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  friendInitial: { color: colors.brand, fontFamily: fonts.semibold, fontSize: 18 },
  friendName: { color: colors.onSurface, fontFamily: fonts.medium, fontSize: 15 },
  friendEmail: { color: colors.muted, fontFamily: fonts.regular, fontSize: 12, marginTop: 2 },
  earnedPill: {
    backgroundColor: "rgba(5,150,105,0.15)",
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  earnedText: { color: colors.success, fontFamily: fonts.semibold, fontSize: 13 },
});
