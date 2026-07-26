import { useCallback, useState } from "react";
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import * as Linking from "expo-linking";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "@/src/context/AuthContext";
import { api } from "@/src/api";
import { useToast } from "@/src/components/Toast";
import { colors, fonts, money, radius, shadow, spacing } from "@/src/theme";

export default function Mine() {
  const { user, logout } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [team, setTeam] = useState<any>({ count: 0, total_earned: 0 });
  const [telegram, setTelegram] = useState("");

  const load = useCallback(async () => {
    try {
      const [r, c] = await Promise.all([api.get("/referrals"), api.get("/config")]);
      setTeam(r);
      setTelegram(c.telegram || "");
    } catch {}
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const copyCode = async () => {
    if (!user?.referral_code) return;
    await Clipboard.setStringAsync(user.referral_code);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    toast.show("Invite code copied!", "success");
  };
  const shareCode = () => Share.share({ message: `Join Victory Pay & get ₹70 bonus! Use my invite code ${user?.referral_code} 🏆` });

  const menu = [
    { icon: "gift-outline", label: "Newbie Rewards", onPress: () => router.push("/(tabs)/plans") },
    { icon: "card-outline", label: "Bind Payment App", onPress: () => router.push("/accounts") },
    { icon: "receipt-outline", label: "Transaction History", onPress: () => router.push("/wallet/history") },
    { icon: "help-circle-outline", label: "Common Problem", onPress: () => router.push("/help") },
    { icon: "headset-outline", label: "Online Service", onPress: () => router.push("/help") },
    { icon: "paper-plane-outline", label: "Official Channel", onPress: () => telegram && Linking.openURL(telegram) },
  ];

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <LinearGradient colors={[colors.brand, colors.brandSecondary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.header, { paddingTop: insets.top + spacing.lg }]}>
          <View style={styles.userRow}>
            <View style={styles.avatar}><Text style={styles.avatarText}>{user?.name?.[0]?.toUpperCase() || "V"}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name} testID="mine-name">{user?.name}</Text>
              <Text style={styles.email}>{user?.email}</Text>
            </View>
            {user?.role === "admin" && (
              <Pressable style={styles.adminBtn} onPress={() => router.push("/admin")} testID="open-admin-button">
                <Ionicons name="grid" size={16} color={colors.brand} />
                <Text style={styles.adminText}>Admin</Text>
              </Pressable>
            )}
          </View>

          <View style={styles.inviteRow}>
            <Ionicons name="ticket-outline" size={16} color="#fff" />
            <Text style={styles.inviteLabel}>Invite code:</Text>
            <Text style={styles.inviteCode} testID="mine-invite-code">{user?.referral_code}</Text>
            <Pressable onPress={copyCode} testID="copy-invite-button"><Ionicons name="copy-outline" size={16} color="#fff" /></Pressable>
            <Pressable onPress={shareCode} testID="share-invite-button" style={{ marginLeft: 4 }}><Ionicons name="share-social-outline" size={16} color="#fff" /></Pressable>
          </View>
        </LinearGradient>

        <View style={styles.body}>
          {/* Current balance */}
          <View style={styles.balanceCard}>
            <View>
              <Text style={styles.balLabel}>Current Balance</Text>
              <Text style={styles.balValue} testID="mine-balance">{money(user?.balance)}</Text>
            </View>
            <Pressable style={styles.withdrawBtn} onPress={() => router.push("/wallet/withdraw")} testID="mine-withdraw-button">
              <Text style={styles.withdrawText}>Withdraw</Text>
            </Pressable>
          </View>

          {/* My team banner */}
          <LinearGradient colors={["#2F6BFF", "#5B8CFF"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.teamBanner}>
            <View style={{ flex: 1 }}>
              <Text style={styles.teamTitle}>My Team</Text>
              <Text style={styles.teamSub}>3-Level rebate mechanism · ₹{team.reward_per_referral || 300}/invite</Text>
            </View>
            <View style={styles.teamStat}>
              <Text style={styles.teamCount}>{team.count || 0}</Text>
              <Text style={styles.teamCountL}>invited</Text>
            </View>
          </LinearGradient>

          {/* Menu */}
          <View style={styles.menu}>
            {menu.map((m, i) => (
              <Pressable key={m.label} style={[styles.menuRow, i < menu.length - 1 && styles.menuBorder]} onPress={m.onPress} testID={`mine-menu-${m.label}`}>
                <View style={styles.menuIcon}><Ionicons name={m.icon as any} size={19} color={colors.brand} /></View>
                <Text style={styles.menuLabel}>{m.label}</Text>
                <Ionicons name="chevron-forward" size={18} color={colors.muted} />
              </Pressable>
            ))}
          </View>

          <Pressable style={styles.logoutBtn} onPress={logout} testID="logout-button">
            <Ionicons name="log-out-outline" size={18} color={colors.error} />
            <Text style={styles.logoutText}>Log out</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  userRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: "rgba(255,255,255,0.22)", borderWidth: 2, borderColor: "#fff", alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontFamily: fonts.bold, fontSize: 26 },
  name: { color: "#fff", fontFamily: fonts.bold, fontSize: 20 },
  email: { color: "rgba(255,255,255,0.85)", fontFamily: fonts.regular, fontSize: 13, marginTop: 2 },
  adminBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#fff", borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 6 },
  adminText: { color: colors.brand, fontFamily: fonts.semibold, fontSize: 12 },
  inviteRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.xl, backgroundColor: "rgba(255,255,255,0.16)", borderRadius: radius.pill, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  inviteLabel: { color: "rgba(255,255,255,0.9)", fontFamily: fonts.regular, fontSize: 13 },
  inviteCode: { flex: 1, color: "#fff", fontFamily: fonts.bold, fontSize: 15, letterSpacing: 1 },
  body: { paddingHorizontal: spacing.lg, marginTop: -spacing.lg, gap: spacing.md },
  balanceCard: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.xl, ...shadow.card },
  balLabel: { color: colors.onSurfaceTertiary, fontFamily: fonts.medium, fontSize: 13 },
  balValue: { color: colors.onSurface, fontFamily: fonts.bold, fontSize: 28, marginTop: 2 },
  withdrawBtn: { backgroundColor: colors.brand, borderRadius: radius.md, paddingHorizontal: spacing.xl, paddingVertical: 12 },
  withdrawText: { color: "#fff", fontFamily: fonts.semibold, fontSize: 14 },
  teamBanner: { flexDirection: "row", alignItems: "center", borderRadius: radius.lg, padding: spacing.lg, ...shadow.soft },
  teamTitle: { color: "#fff", fontFamily: fonts.bold, fontSize: 17 },
  teamSub: { color: "rgba(255,255,255,0.9)", fontFamily: fonts.regular, fontSize: 12, marginTop: 2 },
  teamStat: { alignItems: "center" },
  teamCount: { color: "#fff", fontFamily: fonts.bold, fontSize: 22 },
  teamCountL: { color: "rgba(255,255,255,0.9)", fontFamily: fonts.regular, fontSize: 11 },
  menu: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, paddingHorizontal: spacing.lg, ...shadow.soft },
  menuRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.lg },
  menuBorder: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  menuIcon: { width: 38, height: 38, borderRadius: radius.sm, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  menuLabel: { flex: 1, color: colors.onSurface, fontFamily: fonts.medium, fontSize: 15 },
  logoutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, height: 52, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.error, marginTop: spacing.sm },
  logoutText: { color: colors.error, fontFamily: fonts.semibold, fontSize: 15 },
});
