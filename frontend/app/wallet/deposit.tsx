import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Image } from "expo-image";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { KeyboardAwareScrollView, KeyboardStickyView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "@/src/context/AuthContext";
import { api } from "@/src/api";
import { useToast } from "@/src/components/Toast";
import { Field, GoldButton } from "@/src/components/ui";
import { colors, fonts, radius, spacing } from "@/src/theme";

export default function Deposit() {
  const { refreshUser } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [upi, setUpi] = useState<any>(null);
  const [amount, setAmount] = useState("");
  const [ref, setRef] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api.get("/wallet/upi-info");
      setUpi(r.upi);
    } catch {}
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const copyUpi = async () => {
    if (!upi?.upi_id) return;
    await Clipboard.setStringAsync(upi.upi_id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    toast.show("UPI ID copied!", "success");
  };

  const submit = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return toast.show("Enter a valid amount", "error");
    if (ref.trim().length < 6) return toast.show("Enter a valid UPI reference number", "error");
    setLoading(true);
    try {
      await api.post("/wallet/deposit", { amount: amt, upi_reference: ref.trim() });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.show("Deposit request submitted for approval", "success");
      await refreshUser();
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
        <Pressable onPress={() => router.back()} style={styles.backBtn} testID="deposit-back-button">
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Deposit Funds</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAwareScrollView
        contentContainerStyle={{ padding: spacing.xl, paddingBottom: 40 }}
        bottomOffset={90}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.stepLabel}>Step 1 · Pay via UPI</Text>
        <View style={styles.qrCard}>
          {upi?.qr_image ? (
            <Image source={{ uri: upi.qr_image }} style={styles.qr} contentFit="cover" />
          ) : (
            <View style={[styles.qr, styles.qrPlaceholder]}>
              <Ionicons name="qr-code" size={60} color={colors.muted} />
            </View>
          )}
          <Text style={styles.payTo}>Pay to</Text>
          <Text style={styles.payName}>{upi?.upi_name || "Victory Pay"}</Text>
          <Pressable style={styles.upiRow} onPress={copyUpi} testID="copy-upi-button">
            <Text style={styles.upiId} testID="upi-id">{upi?.upi_id || "—"}</Text>
            <Ionicons name="copy-outline" size={18} color={colors.brand} />
          </Pressable>
        </View>

        <Text style={[styles.stepLabel, { marginTop: spacing.xl }]}>Step 2 · Confirm details</Text>
        <Field
          label="Amount (₹)"
          icon="cash-outline"
          placeholder="500"
          keyboardType="numeric"
          value={amount}
          onChangeText={setAmount}
          testID="deposit-amount-input"
          style={{ marginBottom: spacing.lg }}
        />
        <Field
          label="UPI Reference / Transaction ID"
          icon="receipt-outline"
          placeholder="12-digit reference number"
          keyboardType="numeric"
          value={ref}
          onChangeText={setRef}
          testID="deposit-reference-input"
        />
        <Text style={styles.note}>
          Your deposit will be credited after admin verifies the transaction reference.
        </Text>
      </KeyboardAwareScrollView>

      <KeyboardStickyView offset={{ closed: 0, opened: insets.bottom }}>
        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
          <GoldButton label="Submit Deposit Request" onPress={submit} loading={loading} testID="deposit-submit-button" />
        </View>
      </KeyboardStickyView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: colors.onSurface, fontFamily: fonts.displaySemi, fontSize: 18 },
  stepLabel: { color: colors.brand, fontFamily: fonts.semibold, fontSize: 13, marginBottom: spacing.md },
  qrCard: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    alignItems: "center",
  },
  qr: { width: 180, height: 180, borderRadius: radius.md, backgroundColor: "#fff" },
  qrPlaceholder: { alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceTertiary },
  payTo: { color: colors.muted, fontFamily: fonts.regular, fontSize: 12, marginTop: spacing.lg },
  payName: { color: colors.onSurface, fontFamily: fonts.medium, fontSize: 16, marginTop: 2 },
  upiRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.md,
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  upiId: { color: colors.brand, fontFamily: fonts.medium, fontSize: 15 },
  note: { color: colors.muted, fontFamily: fonts.regular, fontSize: 12, marginTop: spacing.lg, lineHeight: 18 },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
});
