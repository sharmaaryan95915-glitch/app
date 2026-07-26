import { useCallback, useEffect, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { KeyboardAwareScrollView, KeyboardStickyView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";

import { api } from "@/src/api";
import { useToast } from "@/src/components/Toast";
import { GoldButton } from "@/src/components/ui";
import { colors, fonts, money, radius, shadow, spacing } from "@/src/theme";

function SuccessOverlay({ orderId, onDone }: { orderId: string; onDone: () => void }) {
  const scale = useSharedValue(0.3);
  const opacity = useSharedValue(0);
  const tick2 = useSharedValue(0);
  const progress = useSharedValue(0);
  useEffect(() => {
    opacity.value = withTiming(1, { duration: 300 });
    scale.value = withSequence(withTiming(1.12, { duration: 420, easing: Easing.out(Easing.back(2)) }), withTiming(1, { duration: 180 }));
    tick2.value = withDelay(360, withTiming(1, { duration: 300 }));
    progress.value = withDelay(700, withTiming(1, { duration: 2100 }, (f) => { if (f) runOnJS(onDone)(); }));
  }, []);
  const checkStyle = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ scale: scale.value }] }));
  const tick2Style = useAnimatedStyle(() => ({ opacity: tick2.value, transform: [{ scale: tick2.value }] }));
  const barStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));
  return (
    <View style={ov.root} testID="success-overlay">
      <Animated.View style={[ov.checkWrap, checkStyle]}>
        <Ionicons name="checkmark" size={48} color="#fff" />
        <Animated.View style={[ov.tick2, tick2Style]}>
          <Ionicons name="checkmark-done" size={26} color={colors.brand} />
        </Animated.View>
      </Animated.View>
      <Text style={ov.title}>Order Confirmed</Text>
      <View style={ov.orderChip}>
        <Ionicons name="receipt-outline" size={14} color={colors.brand} />
        <Text style={ov.orderId} testID="success-order-id">Order ID: {orderId}</Text>
      </View>
      <Text style={ov.sub}>Your payment has been submitted successfully.{"\n"}Please wait while our team verifies and approves your transaction.</Text>
      <View style={ov.barTrack}><Animated.View style={[ov.barFill, barStyle]} /></View>
      <Text style={ov.wait}>Returning to dashboard…</Text>
    </View>
  );
}

export default function Payment() {
  const params = useLocalSearchParams<{ taskId: string; name: string; amount: string; reward: string; final: string; code: string }>();
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();

  const amount = Number(params.amount || 0);

  const [upi, setUpi] = useState<any>(null);
  const [qrIndex, setQrIndex] = useState(0);
  const [currency, setCurrency] = useState<"INR" | "USDT">("INR");
  const [rate, setRate] = useState(0);
  const [utr, setUtr] = useState("");
  const [remarks, setRemarks] = useState("");
  const [shot, setShot] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [orderId, setOrderId] = useState("");

  const pulse = useSharedValue(0);
  useEffect(() => { pulse.value = withRepeat(withTiming(1, { duration: 1500, easing: Easing.out(Easing.ease) }), -1, false); }, []);
  const pulseStyle = useAnimatedStyle(() => ({ opacity: 0.5 * (1 - pulse.value), transform: [{ scale: 1 + pulse.value * 0.12 }] }));

  const load = useCallback(async () => {
    try {
      const [u, r] = await Promise.all([api.get("/wallet/upi-info"), api.get("/rates/usdt-inr")]);
      setUpi(u.upi);
      setRate(r.rate || 0);
    } catch {}
  }, []);
  useEffect(() => { load(); }, [load]);

  // Auto-rotate QR randomly every 2 minutes
  useEffect(() => {
    const n = upi?.qr_images?.length || 0;
    if (n < 2) return;
    const id = setInterval(() => {
      setQrIndex(() => Math.floor(Math.random() * n));
    }, 120000);
    return () => clearInterval(id);
  }, [upi]);

  const qrList: string[] = upi?.qr_images || [];
  const qr = qrList.length ? qrList[qrIndex % qrList.length] : null;
  const usdtAmount = rate ? (amount / rate) : 0;

  const copy = async (val?: string) => {
    if (!val) return;
    await Clipboard.setStringAsync(val);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    toast.show("Copied!", "success");
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
    if (!utr.trim() || utr.trim().length < 6) return toast.show("Enter a valid UTR / Transaction ID", "error");
    if (!shot) return toast.show("Please attach the payment screenshot", "error");
    setLoading(true);
    try {
      const res = await api.post("/tasks/pay", {
        task_id: params.taskId, screenshot: shot, utr: utr.trim(), remarks: remarks.trim(),
        currency, usdt_amount: currency === "USDT" ? Number(usdtAmount.toFixed(2)) : null, method: upi?.upi_name,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setOrderId(res?.payment?.order_id || "VP" + Date.now());
      setSubmitted(true);
    } catch (e: any) {
      toast.show(e.message || "Failed to submit", "error");
      setLoading(false);
    }
  };

  const infoRows = [
    { label: "Beneficiary Name", value: upi?.beneficiary_name || "—" },
    { label: "Payment Method", value: currency === "USDT" ? "USDT (TRC20)" : (upi?.payment_method || "UPI / QR Payment") },
    { label: currency === "USDT" ? "USDT Address" : "UPI ID / QR Payment", value: currency === "USDT" ? (upi?.usdt_address || "—") : (upi?.big_payment_upi || "—"), copy: true },
    { label: "Amount", value: currency === "USDT" ? `$${usdtAmount.toFixed(2)} (${money(amount)})` : money(amount) },
  ];

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/plans"))} style={styles.backBtn} testID="payment-back-button">
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Complete Payment</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAwareScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }} bottomOffset={100} showsVerticalScrollIndicator={false}>
        {/* Currency toggle */}
        <View style={styles.currencyToggle}>
          <Pressable style={[styles.curBtn, currency === "INR" && styles.curActive]} onPress={() => setCurrency("INR")} testID="currency-inr">
            <Ionicons name="cash" size={16} color={currency === "INR" ? "#fff" : colors.onSurfaceSecondary} />
            <Text style={[styles.curText, currency === "INR" && { color: "#fff" }]}>UPI / INR</Text>
          </Pressable>
          <Pressable style={[styles.curBtn, currency === "USDT" && styles.curActive]} onPress={() => setCurrency("USDT")} testID="currency-usdt">
            <Ionicons name="logo-usd" size={16} color={currency === "USDT" ? "#fff" : colors.onSurfaceSecondary} />
            <Text style={[styles.curText, currency === "USDT" && { color: "#fff" }]}>USDT</Text>
          </Pressable>
        </View>

        {currency === "USDT" && (
          <View style={styles.usdtInfo} testID="usdt-conversion">
            <Text style={styles.usdtRate}>1 USDT ≈ {money(rate)}</Text>
            <Text style={styles.usdtEq}>Pay <Text style={styles.usdtBig}>${usdtAmount.toFixed(2)}</Text> = {money(amount)}</Text>
          </View>
        )}

        {/* Large QR area */}
        <Text style={styles.step}>Scan & pay {currency === "USDT" ? "with USDT" : "via UPI"}</Text>
        <View style={styles.qrCard}>
          <Animated.View style={[styles.pulseRing, pulseStyle]} />
          <View style={styles.qrFrame}>
            {qr ? (
              <Image source={{ uri: qr }} style={styles.qr} contentFit="contain" testID="payment-qr" />
            ) : (
              <View style={[styles.qr, styles.qrPh]}><Ionicons name="qr-code" size={80} color={colors.muted} /></View>
            )}
          </View>
          {qrList.length > 1 && (
            <View style={styles.autoQrHint} testID="auto-qr-hint">
              <Ionicons name="sync-circle" size={14} color={colors.brand} />
              <Text style={styles.autoQrText}>QR auto-refreshes every 2 minutes</Text>
            </View>
          )}
          <View style={styles.trustBadge}>
            <Ionicons name="shield-checkmark" size={14} color={colors.success} />
            <Text style={styles.trustText}>100% Secure · Instant Profit</Text>
          </View>
          <Pressable style={styles.upiUnderQr} onPress={() => copy(currency === "USDT" ? upi?.usdt_address : upi?.big_payment_upi)} testID="upi-under-qr">
            <View>
              <Text style={styles.upiUnderLabel}>{currency === "USDT" ? "USDT Address" : "UPI ID"}</Text>
              <Text style={styles.upiUnderVal} testID="upi-id" numberOfLines={1}>{currency === "USDT" ? (upi?.usdt_address || "—") : (upi?.big_payment_upi || "—")}</Text>
            </View>
            <Ionicons name="copy-outline" size={18} color={colors.brand} />
          </Pressable>
        </View>

        {/* Payment Information */}
        <Text style={styles.step}>Payment Information</Text>
        <View style={styles.infoCard}>
          {infoRows.map((r, i) => (
            <View key={r.label} style={[styles.infoRow, i < infoRows.length - 1 && styles.infoBorder]}>
              <Text style={styles.infoLabel}>{r.label}</Text>
              <Pressable style={styles.infoValWrap} onPress={() => r.copy && copy(r.value)} disabled={!r.copy}>
                <Text style={styles.infoVal} numberOfLines={1}>{r.value}</Text>
                {r.copy && <Ionicons name="copy-outline" size={15} color={colors.brand} style={{ marginLeft: 6 }} />}
              </Pressable>
            </View>
          ))}
          <View style={styles.utrRow}>
            <Text style={styles.infoLabel}>UTR Number <Text style={{ color: colors.error }}>*</Text></Text>
          </View>
          <View style={styles.utrInputWrap}>
            <Ionicons name="receipt-outline" size={18} color={colors.muted} />
            <Animated.View style={{ flex: 1 }}>
              <TextInputBox value={utr} onChange={setUtr} placeholder="Enter 12-digit UTR / Txn ID" keyboard="numeric" testID="payment-utr-input" />
            </Animated.View>
          </View>
        </View>

        {/* Remarks (optional) */}
        <Text style={styles.step}>Remarks (optional)</Text>
        <View style={styles.remarkWrap}>
          <TextInputBox value={remarks} onChange={setRemarks} placeholder="Any note for the reviewer..." testID="payment-remarks-input" />
        </View>

        {/* Screenshot */}
        <Text style={styles.step}>Payment Screenshot <Text style={{ color: colors.error }}>*</Text></Text>
        {shot ? (
          <View style={styles.shotWrap}>
            <Image source={{ uri: shot }} style={styles.shotImg} contentFit="cover" testID="screenshot-preview" />
            <Pressable style={styles.shotChange} onPress={pickShot} testID="change-screenshot-button">
              <Ionicons name="refresh" size={15} color="#fff" /><Text style={styles.shotChangeText}>Change</Text>
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

        {/* Red warning box */}
        <View style={styles.warning} testID="warning-box">
          <Ionicons name="warning" size={20} color={colors.error} />
          <View style={{ flex: 1 }}>
            <Text style={styles.warnTitle}>Warning</Text>
            <Text style={styles.warnText}>Submitting incorrect payment information or fake transaction details may result in rejection of the request and permanent suspension of the account. Ensure all submitted information is accurate.</Text>
          </View>
        </View>
      </KeyboardAwareScrollView>

      <KeyboardStickyView offset={{ closed: 0, opened: insets.bottom }}>
        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
          <GoldButton label={`Submit — Paid ${currency === "USDT" ? "$" + usdtAmount.toFixed(2) : money(amount)}`} onPress={submit} loading={loading} testID="payment-submit-button" />
        </View>
      </KeyboardStickyView>

      {submitted && <SuccessOverlay orderId={orderId} onDone={() => router.replace("/orders")} />}
    </View>
  );
}

// Small controlled text input to keep JSX tidy
function TextInputBox({ value, onChange, placeholder, keyboard, testID }: { value: string; onChange: (v: string) => void; placeholder: string; keyboard?: "numeric" | "default"; testID?: string }) {
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={colors.muted}
      keyboardType={keyboard === "numeric" ? "numeric" : "default"}
      style={styles.tInput}
      testID={testID}
    />
  );
}

const ov = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(242,243,247,0.98)", alignItems: "center", justifyContent: "center", padding: spacing.xxl, zIndex: 1000 },
  checkWrap: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center", ...shadow.card },
  tick2: { position: "absolute", right: -6, bottom: -6, width: 40, height: 40, borderRadius: 20, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", ...shadow.soft },
  title: { color: colors.onSurface, fontFamily: fonts.bold, fontSize: 24, marginTop: spacing.xl },
  orderChip: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.brandTertiary, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 6, marginTop: spacing.md },
  orderId: { color: colors.onBrandTertiary, fontFamily: fonts.semibold, fontSize: 13 },
  sub: { color: colors.onSurfaceTertiary, fontFamily: fonts.regular, fontSize: 14, textAlign: "center", marginTop: spacing.md, lineHeight: 20 },
  barTrack: { width: "70%", height: 6, borderRadius: 3, backgroundColor: colors.border, marginTop: spacing.xl, overflow: "hidden" },
  barFill: { height: 6, borderRadius: 3, backgroundColor: colors.brand },
  wait: { color: colors.muted, fontFamily: fonts.medium, fontSize: 12, marginTop: spacing.md },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.md, backgroundColor: colors.surfaceSecondary, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: colors.onSurface, fontFamily: fonts.bold, fontSize: 18 },
  currencyToggle: { flexDirection: "row", backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: 4, gap: 4, ...shadow.soft },
  curBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 44, borderRadius: radius.sm },
  curActive: { backgroundColor: colors.brand },
  curText: { color: colors.onSurfaceSecondary, fontFamily: fonts.semibold, fontSize: 14 },
  usdtInfo: { backgroundColor: colors.brandTertiary, borderRadius: radius.md, padding: spacing.lg, marginTop: spacing.md, alignItems: "center" },
  usdtRate: { color: colors.onBrandTertiary, fontFamily: fonts.medium, fontSize: 13 },
  usdtEq: { color: colors.onSurface, fontFamily: fonts.medium, fontSize: 15, marginTop: 4 },
  usdtBig: { color: colors.brand, fontFamily: fonts.bold, fontSize: 18 },
  step: { color: colors.onSurface, fontFamily: fonts.bold, fontSize: 15, marginTop: spacing.xl, marginBottom: spacing.md },
  qrCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.xl, alignItems: "center", ...shadow.card },
  pulseRing: { position: "absolute", top: spacing.lg, width: 240, height: 240, borderRadius: 24, borderWidth: 3, borderColor: colors.success, pointerEvents: "none" },
  qrFrame: { width: 230, height: 230, borderRadius: radius.md, backgroundColor: "#fff", borderWidth: 1, borderColor: colors.border, padding: 10, alignItems: "center", justifyContent: "center" },
  qr: { width: "100%", height: "100%" },
  qrPh: { alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceTertiary },
  changeQr: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.lg, backgroundColor: colors.brandTertiary, borderRadius: radius.pill, paddingHorizontal: spacing.lg, paddingVertical: 8 },
  changeQrText: { color: colors.brand, fontFamily: fonts.semibold, fontSize: 13 },
  autoQrHint: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: spacing.md },
  autoQrText: { color: colors.onSurfaceTertiary, fontFamily: fonts.regular, fontSize: 11 },
  trustBadge: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.md, backgroundColor: colors.brandTertiary, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 6 },
  trustText: { color: colors.success, fontFamily: fonts.medium, fontSize: 12 },
  upiUnderQr: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "100%", marginTop: spacing.md, backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  upiUnderLabel: { color: colors.muted, fontFamily: fonts.regular, fontSize: 11 },
  upiUnderVal: { color: colors.brand, fontFamily: fonts.bold, fontSize: 16, marginTop: 2 },
  infoCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, paddingHorizontal: spacing.lg, ...shadow.soft },
  infoRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: spacing.md },
  infoBorder: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  infoLabel: { color: colors.onSurfaceTertiary, fontFamily: fonts.medium, fontSize: 13 },
  infoValWrap: { flexDirection: "row", alignItems: "center", maxWidth: "60%" },
  infoVal: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: 14 },
  utrRow: { paddingTop: spacing.md },
  utrInputWrap: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 50, marginTop: spacing.sm, marginBottom: spacing.lg },
  remarkWrap: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, paddingHorizontal: spacing.lg, height: 50, justifyContent: "center", ...shadow.soft },
  tInput: { color: colors.onSurface, fontFamily: fonts.regular, fontSize: 15, height: 50 },
  upload: { borderWidth: 1.5, borderColor: colors.borderStrong, borderStyle: "dashed", borderRadius: radius.md, paddingVertical: spacing.xxl, alignItems: "center", gap: spacing.sm, backgroundColor: colors.surfaceSecondary },
  uploadText: { color: colors.onSurfaceTertiary, fontFamily: fonts.medium, fontSize: 14 },
  shotWrap: { borderRadius: radius.md, overflow: "hidden", ...shadow.soft },
  shotImg: { width: "100%", height: 220, backgroundColor: colors.surfaceTertiary },
  shotChange: { position: "absolute", bottom: spacing.md, right: spacing.md, flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(20,24,33,0.8)", borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 6 },
  shotChangeText: { color: "#fff", fontFamily: fonts.medium, fontSize: 12 },
  settingsBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: spacing.md },
  settingsText: { color: colors.brand, fontFamily: fonts.medium, fontSize: 13 },
  warning: { flexDirection: "row", gap: spacing.md, marginTop: spacing.xl, backgroundColor: "#FDECEC", borderColor: colors.error, borderWidth: 1, borderRadius: radius.md, padding: spacing.lg },
  warnTitle: { color: colors.error, fontFamily: fonts.bold, fontSize: 15, marginBottom: 4 },
  warnText: { color: "#9B2C2C", fontFamily: fonts.regular, fontSize: 12, lineHeight: 18 },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, backgroundColor: colors.surfaceSecondary, borderTopWidth: 1, borderTopColor: colors.border },
});
