import { useCallback, useEffect, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { KeyboardAwareScrollView, KeyboardStickyView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";

import { api } from "@/src/api";
import { useToast } from "@/src/components/Toast";
import { GoldButton } from "@/src/components/ui";
import { colors, fonts, money, radius, spacing } from "@/src/theme";

export default function Payment() {
  const params = useLocalSearchParams<{ taskId: string; name: string; amount: string; reward: string; code: string }>();
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();

  const amount = Number(params.amount || 0);
  const reward = Number(params.reward || 0);
  const total = amount + reward;

  const [upi, setUpi] = useState<any>(null);
  const [qrIndex] = useState(() => (Math.random() < 0.5 ? 0 : 1));
  const [shot, setShot] = useState<string | null>(null);
  const [agree, setAgree] = useState(false);
  const [loading, setLoading] = useState(false);
  const [blocked, setBlocked] = useState(false);

  // green profit pulse
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 1500, easing: Easing.out(Easing.ease) }), -1, false);
  }, []);
  const pulseStyle = useAnimatedStyle(() => ({
    opacity: 0.6 * (1 - pulse.value),
    transform: [{ scale: 1 + pulse.value * 0.15 }],
  }));

  const load = useCallback(async () => {
    try {
      const r = await api.get("/wallet/upi-info");
      setUpi(r.upi);
    } catch {}
  }, []);
  useEffect(() => { load(); }, [load]);

  const qr = upi?.qr_images?.length ? upi.qr_images[qrIndex % upi.qr_images.length] : null;

  const copyUpi = async () => {
    const id = upi?.big_payment_upi || upi?.upi_id;
    if (!id) return;
    await Clipboard.setStringAsync(id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    toast.show("UPI ID copied!", "success");
  };

  const pickShot = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      if (!perm.canAskAgain) setBlocked(true);
      toast.show("Photo permission needed to upload screenshot", "error");
      return;
    }
    setBlocked(false);
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.4, base64: true });
    if (!res.canceled && res.assets?.[0]?.base64) {
      setShot("data:image/jpeg;base64," + res.assets[0].base64);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const submit = async () => {
    if (!shot) return toast.show("Please attach the payment screenshot", "error");
    if (!agree) return toast.show("Please confirm the screenshot declaration", "error");
    setLoading(true);
    try {
      await api.post("/tasks/pay", { task_id: params.taskId, screenshot: shot, method: upi?.upi_name });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.show("Submitted! Balance credited after admin verifies.", "success");
      router.back();
    } catch (e: any) {
      toast.show(e.message || "Failed to submit", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/plans"))} style={styles.backBtn} testID="payment-back-button">
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Complete Payment</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAwareScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 40 }} bottomOffset={100} showsVerticalScrollIndicator={false}>
        {/* Summary */}
        <View style={styles.summary}>
          <View style={styles.codePill}>
            <Ionicons name="pricetag" size={10} color={colors.onBrandTertiary} />
            <Text style={styles.codeText}>{params.code}</Text>
          </View>
          <Text style={styles.taskName}>{params.name}</Text>
          <View style={styles.summaryRow}>
            <View>
              <Text style={styles.sLabel}>Pay now</Text>
              <Text style={styles.sPay}>{money(amount)}</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={styles.sLabel}>You will receive</Text>
              <Text style={styles.sGet}>{money(total)}</Text>
            </View>
          </View>
        </View>

        {/* QR with green profit pulse */}
        <Text style={styles.step}>Step 1 · Scan & pay via UPI</Text>
        <View style={styles.qrCard}>
          <Animated.View style={[styles.pulseRing, pulseStyle]} pointerEvents="none" />
          <View style={styles.qrFrame}>
            {qr ? (
              <Image source={{ uri: qr }} style={styles.qr} contentFit="contain" testID="payment-qr" />
            ) : (
              <View style={[styles.qr, styles.qrPh]}><Ionicons name="qr-code" size={70} color={colors.muted} /></View>
            )}
          </View>
          <View style={styles.trustBadge}>
            <Ionicons name="shield-checkmark" size={14} color={colors.success} />
            <Text style={styles.trustText}>100% Secure · Instant Profit</Text>
          </View>
          <Pressable style={styles.upiRow} onPress={copyUpi} testID="copy-upi-button">
            <View>
              <Text style={styles.upiLabel}>UPI ID (for big payments)</Text>
              <Text style={styles.upiId} testID="upi-id">{upi?.big_payment_upi || "—"}</Text>
            </View>
            <Ionicons name="copy-outline" size={20} color={colors.brand} />
          </Pressable>
        </View>

        {/* Screenshot */}
        <Text style={styles.step}>Step 2 · Upload payment screenshot</Text>
        {shot ? (
          <View style={styles.shotWrap}>
            <Image source={{ uri: shot }} style={styles.shotImg} contentFit="cover" testID="screenshot-preview" />
            <Pressable style={styles.shotChange} onPress={pickShot} testID="change-screenshot-button">
              <Ionicons name="refresh" size={16} color={colors.onSurface} />
              <Text style={styles.shotChangeText}>Change</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable style={styles.upload} onPress={pickShot} testID="upload-screenshot-button">
            <Ionicons name="cloud-upload-outline" size={28} color={colors.brand} />
            <Text style={styles.uploadText}>Tap to attach screenshot</Text>
          </Pressable>
        )}
        {blocked && (
          <Pressable style={styles.settingsBtn} onPress={() => Linking.openSettings()} testID="open-settings-button">
            <Ionicons name="settings-outline" size={16} color={colors.brand} />
            <Text style={styles.settingsText}>Open Settings to allow photos</Text>
          </Pressable>
        )}

        {/* Declaration */}
        <Pressable style={styles.declare} onPress={() => setAgree((v) => !v)} testID="declaration-checkbox">
          <View style={[styles.checkbox, agree && styles.checkboxOn]}>
            {agree && <Ionicons name="checkmark" size={14} color={colors.onBrandPrimary} />}
          </View>
          <Text style={styles.declareText}>
            I confirm the screenshot is real-time (within 2–3 minutes). False or old screenshots will be rejected as false declaration.
          </Text>
        </Pressable>
      </KeyboardAwareScrollView>

      <KeyboardStickyView offset={{ closed: 0, opened: insets.bottom }}>
        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
          <GoldButton label={`Submit — I've Paid ${money(amount)}`} onPress={submit} loading={loading} testID="payment-submit-button" />
        </View>
      </KeyboardStickyView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: colors.onSurface, fontFamily: fonts.displaySemi, fontSize: 18 },
  summary: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.brandTertiary, padding: spacing.xl },
  codePill: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", backgroundColor: colors.brandTertiary, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 3, marginBottom: spacing.sm },
  codeText: { color: colors.onBrandTertiary, fontFamily: fonts.medium, fontSize: 11, letterSpacing: 1 },
  taskName: { color: colors.onSurface, fontFamily: fonts.displaySemi, fontSize: 22 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.lg },
  sLabel: { color: colors.muted, fontFamily: fonts.regular, fontSize: 12 },
  sPay: { color: colors.onSurface, fontFamily: fonts.display, fontSize: 26 },
  sGet: { color: colors.brand, fontFamily: fonts.display, fontSize: 26 },
  step: { color: colors.brand, fontFamily: fonts.semibold, fontSize: 13, marginTop: spacing.xl, marginBottom: spacing.md },
  qrCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.xl, alignItems: "center" },
  pulseRing: { position: "absolute", top: spacing.lg, width: 220, height: 220, borderRadius: 24, borderWidth: 3, borderColor: colors.success },
  qrFrame: { width: 210, height: 210, borderRadius: radius.md, backgroundColor: "#fff", padding: 10, alignItems: "center", justifyContent: "center" },
  qr: { width: "100%", height: "100%" },
  qrPh: { alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceTertiary },
  trustBadge: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.lg, backgroundColor: "rgba(5,150,105,0.14)", borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 6 },
  trustText: { color: colors.success, fontFamily: fonts.medium, fontSize: 12 },
  upiRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "100%", marginTop: spacing.lg, backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: spacing.md },
  upiLabel: { color: colors.muted, fontFamily: fonts.regular, fontSize: 11 },
  upiId: { color: colors.brand, fontFamily: fonts.semibold, fontSize: 16, marginTop: 2 },
  upload: { borderWidth: 1.5, borderColor: colors.borderStrong, borderStyle: "dashed", borderRadius: radius.md, paddingVertical: spacing.xxl, alignItems: "center", gap: spacing.sm, backgroundColor: colors.surfaceSecondary },
  uploadText: { color: colors.onSurfaceTertiary, fontFamily: fonts.medium, fontSize: 14 },
  shotWrap: { borderRadius: radius.md, overflow: "hidden", borderWidth: 1, borderColor: colors.border },
  shotImg: { width: "100%", height: 220, backgroundColor: colors.surfaceTertiary },
  shotChange: { position: "absolute", bottom: spacing.md, right: spacing.md, flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(18,18,18,0.85)", borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 6 },
  shotChangeText: { color: colors.onSurface, fontFamily: fonts.medium, fontSize: 12 },
  settingsBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: spacing.md },
  settingsText: { color: colors.brand, fontFamily: fonts.medium, fontSize: 13 },
  declare: { flexDirection: "row", gap: spacing.md, marginTop: spacing.xl, alignItems: "flex-start" },
  checkbox: { width: 24, height: 24, borderRadius: radius.sm, borderWidth: 1.5, borderColor: colors.borderStrong, alignItems: "center", justifyContent: "center" },
  checkboxOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  declareText: { flex: 1, color: colors.onSurfaceTertiary, fontFamily: fonts.regular, fontSize: 12, lineHeight: 18 },
  footer: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, backgroundColor: colors.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
});
