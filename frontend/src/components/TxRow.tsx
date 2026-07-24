import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { colors, fonts, money, radius, spacing } from "@/src/theme";

const MAP: Record<string, { icon: string; color: string }> = {
  bonus: { icon: "gift", color: colors.brand },
  referral: { icon: "people", color: colors.success },
  deposit: { icon: "arrow-down-circle", color: colors.success },
  withdraw: { icon: "arrow-up-circle", color: colors.error },
  plan: { icon: "layers", color: colors.warning },
  plan_reward: { icon: "trending-up", color: colors.success },
};

function fmtDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }) +
      " · " + d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export function TxRow({ tx }: { tx: any }) {
  const meta = MAP[tx.type] || { icon: "cash", color: colors.muted };
  const positive = tx.amount >= 0;
  return (
    <View style={styles.row} testID={`tx-row-${tx.tx_id}`}>
      <View style={[styles.icon, { backgroundColor: colors.surfaceTertiary }]}>
        <Ionicons name={meta.icon as any} size={20} color={meta.color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.title} numberOfLines={1}>{tx.title}</Text>
        <Text style={styles.date}>{fmtDate(tx.created_at)}</Text>
      </View>
      <Text style={[styles.amount, { color: positive ? colors.success : colors.error }]}>
        {positive ? "+" : "-"}{money(Math.abs(tx.amount))}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  icon: { width: 44, height: 44, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  title: { color: colors.onSurface, fontFamily: fonts.medium, fontSize: 15 },
  date: { color: colors.muted, fontFamily: fonts.regular, fontSize: 12, marginTop: 2 },
  amount: { fontFamily: fonts.semibold, fontSize: 15 },
});
