import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { KeyboardAwareScrollView, KeyboardStickyView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "@/src/context/AuthContext";
import { api } from "@/src/api";
import { useToast } from "@/src/components/Toast";
import { Field, GoldButton } from "@/src/components/ui";
import { colors, fonts, money, radius, spacing } from "@/src/theme";

export default function Withdraw() {
  const { user, refreshUser } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [amount, setAmount] = useState("");
  const [upiId, setUpiId] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return toast.show("Enter a valid amount", "error");
    if (amt > (user?.balance ?? 0)) return toast.show("Insufficient balance", "error");
    if (!upiId.trim() || !upiId.includes("@")) return toast.show("Enter a valid UPI ID", "error");
    setLoading(true);
    try {
      await api.post("/wallet/withdraw", { amount: amt, upi_id: upiId.trim() });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.show("Withdrawal request submitted for approval", "success");
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
        <Pressable onPress={() => router.back()} style={styles.backBtn} testID="withdraw-back-button">
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Withdraw Funds</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAwareScrollView
        contentContainerStyle={{ padding: spacing.xl, paddingBottom: 40 }}
        bottomOffset={90}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Available Balance</Text>
          <Text style={styles.balanceValue} testID="withdraw-balance">{money(user?.balance)}</Text>
        </View>

        <Field
          label="Amount (₹)"
          icon="cash-outline"
          placeholder="Enter amount"
          keyboardType="numeric"
          value={amount}
          onChangeText={setAmount}
          testID="withdraw-amount-input"
          style={{ marginTop: spacing.xl, marginBottom: spacing.lg }}
        />
        <Field
          label="Your UPI ID"
          icon="at-outline"
          placeholder="yourname@bank"
          autoCapitalize="none"
          value={upiId}
          onChangeText={setUpiId}
          testID="withdraw-upi-input"
        />
        <Text style={styles.note}>
          Withdrawals are processed to your UPI ID after admin approval, usually within 24 hours.
        </Text>
      </KeyboardAwareScrollView>

      <KeyboardStickyView offset={{ closed: 0, opened: insets.bottom }}>
        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
          <GoldButton label="Request Withdrawal" onPress={submit} loading={loading} testID="withdraw-submit-button" />
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
  balanceCard: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.brandTertiary,
    padding: spacing.xl,
    alignItems: "center",
  },
  balanceLabel: { color: colors.onSurfaceTertiary, fontFamily: fonts.regular, fontSize: 13 },
  balanceValue: { color: colors.brand, fontFamily: fonts.display, fontSize: 36, marginTop: spacing.xs },
  note: { color: colors.muted, fontFamily: fonts.regular, fontSize: 12, marginTop: spacing.lg, lineHeight: 18 },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
});
