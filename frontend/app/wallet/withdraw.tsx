import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
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
  const [accounts, setAccounts] = useState<any[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api.get("/accounts");
      setAccounts(r.accounts || []);
      if ((r.accounts || []).length && !selected) setSelected(r.accounts[0].account_id);
    } catch {}
  }, [selected]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const submit = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return toast.show("Enter a valid amount", "error");
    if (amt > (user?.balance ?? 0)) return toast.show("Insufficient balance", "error");
    if (!selected) return toast.show("Select or add a payout account", "error");
    setLoading(true);
    try {
      await api.post("/wallet/withdraw", { amount: amt, account_id: selected });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.show("Withdrawal request submitted", "success");
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
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)"))} style={styles.backBtn} testID="withdraw-back-button">
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Withdraw Funds</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAwareScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 40 }} bottomOffset={90} showsVerticalScrollIndicator={false}>
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Available Balance</Text>
          <Text style={styles.balanceValue} testID="withdraw-balance">{money(user?.balance)}</Text>
        </View>

        <Field label="Amount (₹)" icon="cash-outline" placeholder="Enter amount" keyboardType="numeric" value={amount} onChangeText={setAmount} testID="withdraw-amount-input" style={{ marginTop: spacing.xl, marginBottom: spacing.xl }} />

        <View style={styles.acctHeader}>
          <Text style={styles.sectionTitle}>Payout Account</Text>
          <Pressable onPress={() => router.push("/accounts")} testID="withdraw-add-account">
            <Text style={styles.addLink}>+ Add</Text>
          </Pressable>
        </View>

        {accounts.length === 0 ? (
          <Pressable style={styles.noAcct} onPress={() => router.push("/accounts")} testID="withdraw-no-account">
            <Ionicons name="add-circle-outline" size={22} color={colors.brand} />
            <Text style={styles.noAcctText}>Add a payout account to withdraw</Text>
          </Pressable>
        ) : (
          accounts.map((a) => (
            <Pressable key={a.account_id} style={[styles.acct, selected === a.account_id && styles.acctSel]} onPress={() => setSelected(a.account_id)} testID={`withdraw-account-${a.account_id}`}>
              <View style={[styles.radio, selected === a.account_id && styles.radioOn]}>
                {selected === a.account_id && <View style={styles.radioDot} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.acctMethod}>{a.method}</Text>
                <Text style={styles.acctUpi} numberOfLines={1}>{a.holder_name} · {a.upi_id}</Text>
              </View>
            </Pressable>
          ))
        )}

        <Text style={styles.note}>Withdrawals are processed to your selected account after admin approval.</Text>
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
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: colors.onSurface, fontFamily: fonts.displaySemi, fontSize: 18 },
  balanceCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.brandTertiary, padding: spacing.xl, alignItems: "center" },
  balanceLabel: { color: colors.onSurfaceTertiary, fontFamily: fonts.regular, fontSize: 13 },
  balanceValue: { color: colors.brand, fontFamily: fonts.display, fontSize: 36, marginTop: spacing.xs },
  acctHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md },
  sectionTitle: { color: colors.onSurface, fontFamily: fonts.displaySemi, fontSize: 18 },
  addLink: { color: colors.brand, fontFamily: fonts.semibold, fontSize: 14 },
  noAcct: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, borderWidth: 1.5, borderStyle: "dashed", borderColor: colors.borderStrong, borderRadius: radius.md, paddingVertical: spacing.xl, backgroundColor: colors.surfaceSecondary },
  noAcctText: { color: colors.onSurfaceTertiary, fontFamily: fonts.medium, fontSize: 14 },
  acct: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.md },
  acctSel: { borderColor: colors.brand },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.borderStrong, alignItems: "center", justifyContent: "center" },
  radioOn: { borderColor: colors.brand },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.brand },
  acctMethod: { color: colors.onSurface, fontFamily: fonts.medium, fontSize: 15 },
  acctUpi: { color: colors.muted, fontFamily: fonts.regular, fontSize: 12, marginTop: 2 },
  note: { color: colors.muted, fontFamily: fonts.regular, fontSize: 12, marginTop: spacing.lg, lineHeight: 18 },
  footer: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, backgroundColor: colors.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
});
