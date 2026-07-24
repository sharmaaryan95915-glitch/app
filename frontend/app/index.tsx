import { useRouter } from "expo-router";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "@/src/context/AuthContext";
import { GoldButton } from "@/src/components/ui";
import { colors, fonts, IMAGES, radius, spacing } from "@/src/theme";

const STATS = [
  { label: "Signup bonus", value: "₹70" },
  { label: "Per referral", value: "₹300" },
  { label: "On every plan", value: "4%" },
];

const FEATURES = [
  { icon: "trending-up", title: "Reward Plans", desc: "Activate ₹500–₹10,000 plans, earn 4%." },
  { icon: "people", title: "Real Referrals", desc: "Invite friends, earn ₹300 each." },
  { icon: "wallet", title: "Instant Wallet", desc: "UPI deposits & withdrawals, full history." },
  { icon: "shield-checkmark", title: "Secure Login", desc: "Bank-grade session security." },
];

export default function Landing() {
  const { loading } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  if (loading) {
    return (
      <View style={styles.loader} testID="landing-loader">
        <ActivityIndicator color={colors.brand} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <Image source={{ uri: IMAGES.heroBg }} style={StyleSheet.absoluteFill} contentFit="cover" />
          <LinearGradient
            colors={["rgba(18,18,18,0.45)", "rgba(18,18,18,0.85)", colors.surface]}
            style={StyleSheet.absoluteFill}
          />
          <View style={[styles.heroContent, { paddingTop: insets.top + spacing.xxl }]}>
            <View style={styles.badge}>
              <View style={styles.dot} />
              <Text style={styles.badgeText}>PREMIUM REWARDS · PLAY · WIN · PROFIT</Text>
            </View>
            <Text style={styles.brandName} testID="brand-name">Victory Pay</Text>
            <Text style={styles.headline}>
              A premium wallet for your <Text style={styles.headlineItalic}>victories</Text>.
            </Text>
            <Text style={styles.sub}>
              Activate reward plans, invite friends for ₹300 each, and manage everything from a beautifully
              crafted wallet.
            </Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          {STATS.map((s) => (
            <View key={s.label} style={styles.statBox}>
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.ctaWrap}>
          <GoldButton
            label="Enter Wallet — It's Free"
            icon="arrow-forward"
            onPress={() => router.push("/(auth)/register")}
            testID="landing-register-button"
          />
          <View style={{ height: spacing.md }} />
          <GoldButton
            label="Sign in"
            variant="outline"
            onPress={() => router.push("/(auth)/login")}
            testID="landing-login-button"
          />
        </View>

        <View style={styles.features}>
          {FEATURES.map((f, i) => (
            <Animated.View
              key={f.title}
              entering={FadeInDown.delay(i * 80)}
              style={styles.featureCard}
            >
              <View style={styles.featureIcon}>
                <Ionicons name={f.icon as any} size={22} color={colors.brand} />
              </View>
              <Text style={styles.featureTitle}>{f.title}</Text>
              <Text style={styles.featureDesc}>{f.desc}</Text>
            </Animated.View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  loader: { flex: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  hero: { minHeight: 420, paddingBottom: spacing.xl },
  heroContent: { paddingHorizontal: spacing.xl },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    alignSelf: "flex-start",
    backgroundColor: "rgba(212,175,55,0.12)",
    borderColor: colors.brandTertiary,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
  },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.brand },
  badgeText: { color: colors.onBrandTertiary, fontFamily: fonts.medium, fontSize: 10, letterSpacing: 0.5 },
  brandName: { color: colors.brand, fontFamily: fonts.displaySemi, fontSize: 22, marginTop: spacing.xl },
  headline: { color: colors.onSurface, fontFamily: fonts.display, fontSize: 40, lineHeight: 46, marginTop: spacing.sm },
  headlineItalic: { color: colors.brand, fontFamily: fonts.displaySemi, fontStyle: "italic" },
  sub: { color: colors.onSurfaceTertiary, fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, marginTop: spacing.md },
  statsRow: { flexDirection: "row", paddingHorizontal: spacing.xl, gap: spacing.md, marginTop: spacing.sm },
  statBox: {
    flex: 1,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.lg,
    alignItems: "center",
  },
  statValue: { color: colors.brand, fontFamily: fonts.display, fontSize: 22 },
  statLabel: { color: colors.onSurfaceTertiary, fontFamily: fonts.regular, fontSize: 11, marginTop: 4, textAlign: "center" },
  ctaWrap: { paddingHorizontal: spacing.xl, marginTop: spacing.xl },
  features: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, paddingHorizontal: spacing.xl, marginTop: spacing.xl },
  featureCard: {
    width: "47%",
    flexGrow: 1,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  featureIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  featureTitle: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: 15 },
  featureDesc: { color: colors.onSurfaceTertiary, fontFamily: fonts.regular, fontSize: 12, marginTop: 4, lineHeight: 17 },
});
