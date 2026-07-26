import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeInRight } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";

import { colors, fonts, radius, shadow, spacing } from "@/src/theme";

const STEPS = [
  { icon: "trending-up", title: "1 · Pick a Task", desc: "Go to Buy RP, choose your level (start with the New User plans) and tap Receive." },
  { icon: "qr-code", title: "2 · Pay via UPI / QR", desc: "Scan the QR or pay to the UPI ID shown. Then upload your payment screenshot + UTR." },
  { icon: "checkmark-done", title: "3 · Get Approved", desc: "Our team verifies your payment. Your amount + profit is instantly added to your balance." },
  { icon: "wallet", title: "4 · Withdraw Anytime", desc: "Add your payout account in Sell RP and withdraw your earnings to UPI or bank." },
];

export function Onboarding({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const s = STEPS[step];
  const last = step === STEPS.length - 1;
  return (
    <Animated.View entering={FadeIn} style={styles.root} testID="onboarding-overlay">
      <View style={styles.card}>
        <Text style={styles.welcome}>Welcome to Victory Pay 🎉</Text>
        <Text style={styles.subtitle}>Here&apos;s how to start earning in 4 easy steps</Text>
        <Animated.View key={step} entering={FadeInRight} style={styles.stepBox}>
          <View style={styles.iconWrap}><Ionicons name={s.icon as any} size={34} color={colors.brand} /></View>
          <Text style={styles.stepTitle}>{s.title}</Text>
          <Text style={styles.stepDesc}>{s.desc}</Text>
        </Animated.View>
        <View style={styles.dots}>
          {STEPS.map((_, i) => <View key={i} style={[styles.dot, i === step && styles.dotActive]} />)}
        </View>
        <Pressable style={styles.btn} onPress={() => (last ? onDone() : setStep((v) => v + 1))} testID="onboarding-next">
          <Text style={styles.btnText}>{last ? "Start Earning" : "Next"}</Text>
          <Ionicons name={last ? "rocket" : "arrow-forward"} size={18} color="#fff" />
        </Pressable>
        {!last && <Pressable onPress={onDone} testID="onboarding-skip"><Text style={styles.skip}>Skip</Text></Pressable>}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(20,24,33,0.55)", alignItems: "center", justifyContent: "center", padding: spacing.xl, zIndex: 1000 },
  card: { width: "100%", backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.xl, ...shadow.card },
  welcome: { color: colors.onSurface, fontFamily: fonts.bold, fontSize: 22, textAlign: "center" },
  subtitle: { color: colors.onSurfaceTertiary, fontFamily: fonts.regular, fontSize: 13, textAlign: "center", marginTop: 4 },
  stepBox: { alignItems: "center", marginTop: spacing.xl, paddingHorizontal: spacing.md },
  iconWrap: { width: 74, height: 74, borderRadius: 37, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  stepTitle: { color: colors.onSurface, fontFamily: fonts.bold, fontSize: 18, marginTop: spacing.lg },
  stepDesc: { color: colors.onSurfaceTertiary, fontFamily: fonts.regular, fontSize: 14, textAlign: "center", marginTop: spacing.sm, lineHeight: 20, minHeight: 60 },
  dots: { flexDirection: "row", justifyContent: "center", gap: 6, marginVertical: spacing.lg },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.border },
  dotActive: { width: 20, backgroundColor: colors.brand },
  btn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, height: 52, borderRadius: radius.md, backgroundColor: colors.brand },
  btnText: { color: "#fff", fontFamily: fonts.semibold, fontSize: 16 },
  skip: { color: colors.muted, fontFamily: fonts.medium, fontSize: 14, textAlign: "center", marginTop: spacing.md },
});
