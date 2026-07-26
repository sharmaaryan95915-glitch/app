import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { api } from "@/src/api";
import { useToast } from "@/src/components/Toast";
import { Field, GoldButton } from "@/src/components/ui";
import { colors, fonts, radius, spacing } from "@/src/theme";

const METHODS = [
  { key: "PhonePe", color: "#5f259f" },
  { key: "Google Pay", color: "#1a73e8" },
  { key: "Paytm", color: "#00baf2" },
  { key: "FamPay", color: "#f9c74f" },
  { key: "Navi UPI", color: "#2a5cff" },
  { key: "Bank Account", color: "#2a9d8f" },
];

export default function Accounts() {
  const toast = useToast();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [method, setMethod] = useState("PhonePe");
  const [holder, setHolder] = useState("");
  const [upiId, setUpiId] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api.get("/accounts");
      setAccounts(r.accounts || []);
    } catch {}
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const add = async () => {
    if (!holder.trim()) return toast.show("Enter account holder name", "error");
    if (!upiId.includes("@")) return toast.show("Enter a valid UPI ID", "error");
    setSaving(true);
    try {
      await api.post("/accounts", { method, holder_name: holder.trim(), upi_id: upiId.trim() });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.show("Account added", "success");
      setHolder(""); setUpiId("");
      await load();
    } catch (e: any) {
      toast.show(e.message || "Failed", "error");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await api.del(`/accounts/${id}`);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      toast.show("Account removed", "info");
      await load();
    } catch {
      toast.show("Failed to remove", "error");
    }
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/profile"))} style={styles.backBtn} testID="accounts-back-button">
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Payout Accounts</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAwareScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + 40 }} bottomOffset={24} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>Add Payout Method</Text>
        <View style={styles.methodGrid}>
          {METHODS.map((m) => (
            <Pressable
              key={m.key}
              style={[styles.methodChip, method === m.key && { borderColor: colors.brand, backgroundColor: colors.brandTertiary }]}
              onPress={() => setMethod(m.key)}
              testID={`method-${m.key}`}
            >
              <View style={[styles.methodDot, { backgroundColor: m.color }]} />
              <Text style={[styles.methodText, method === m.key && { color: colors.onSurface }]}>{m.key}</Text>
            </Pressable>
          ))}
        </View>

        <Field label="Account Holder Name" icon="person-outline" placeholder="Full name" value={holder} onChangeText={setHolder} testID="account-holder-input" style={{ marginTop: spacing.lg, marginBottom: spacing.lg }} />
        <Field label="UPI ID" icon="at-outline" placeholder="yourname@bank" autoCapitalize="none" value={upiId} onChangeText={setUpiId} testID="account-upi-input" style={{ marginBottom: spacing.xl }} />
        <GoldButton label="Save Account" icon="add" onPress={add} loading={saving} testID="account-save-button" />

        <Text style={[styles.sectionTitle, { marginTop: spacing.xxl }]}>Saved Accounts</Text>
        {loading ? (
          <ActivityIndicator color={colors.brand} style={{ marginTop: spacing.lg }} />
        ) : accounts.length === 0 ? (
          <Text style={styles.empty}>No payout accounts added yet.</Text>
        ) : (
          accounts.map((a) => {
            const m = METHODS.find((x) => x.key === a.method) || METHODS[0];
            return (
              <View key={a.account_id} style={styles.acctRow} testID={`account-${a.account_id}`}>
                <View style={[styles.acctIcon, { backgroundColor: m.color }]}>
                  <Text style={styles.acctIconText}>{a.method[0]}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.acctMethod}>{a.method}</Text>
                  <Text style={styles.acctUpi} numberOfLines={1}>{a.holder_name} · {a.upi_id}</Text>
                </View>
                <Pressable onPress={() => remove(a.account_id)} style={styles.delBtn} testID={`delete-account-${a.account_id}`}>
                  <Ionicons name="trash-outline" size={18} color={colors.error} />
                </Pressable>
              </View>
            );
          })
        )}
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: colors.onSurface, fontFamily: fonts.displaySemi, fontSize: 18 },
  sectionTitle: { color: colors.onSurface, fontFamily: fonts.displaySemi, fontSize: 18, marginBottom: spacing.md },
  methodGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  methodChip: { flexDirection: "row", alignItems: "center", gap: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.surfaceSecondary },
  methodDot: { width: 12, height: 12, borderRadius: 6 },
  methodText: { color: colors.onSurfaceTertiary, fontFamily: fonts.medium, fontSize: 13 },
  empty: { color: colors.muted, fontFamily: fonts.regular, fontSize: 14, marginTop: spacing.md },
  acctRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginTop: spacing.md },
  acctIcon: { width: 44, height: 44, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  acctIconText: { color: "#fff", fontFamily: fonts.semibold, fontSize: 18 },
  acctMethod: { color: colors.onSurface, fontFamily: fonts.medium, fontSize: 15 },
  acctUpi: { color: colors.muted, fontFamily: fonts.regular, fontSize: 12, marginTop: 2 },
  delBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
});
