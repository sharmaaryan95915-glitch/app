import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";

import { api } from "@/src/api";
import { colors, fonts, radius, shadow, spacing } from "@/src/theme";

const LEVELS = [0, 1, 2, 3, 4, 5, 6, 7];

export default function BuyRP() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [tasks, setTasks] = useState<any[]>([]);
  const [level, setLevel] = useState(0);
  const [asc, setAsc] = useState(true);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const r = await api.get("/tasks");
      setTasks(r.tasks || []);
    } catch {}
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const isNew = level === 0;
  const list = useMemo(() => {
    const l = tasks.filter((t) => (isNew ? t.new_user : t.level === level && !t.new_user));
    return [...l].sort((a, b) => (asc ? a.amount - b.amount : b.amount - a.amount));
  }, [tasks, level, asc, isNew]);

  const goPay = (t: any) => {
    router.push({
      pathname: "/payment/[taskId]",
      params: { taskId: t.task_id, name: `L${t.level} Order`, amount: String(t.amount), reward: String(t.reward), final: String(t.final), code: t.code },
    });
  };

  return (
    <View style={styles.root}>
      {/* Green header with level tabs */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.levelRow}>
          {LEVELS.map((l) => (
            <Pressable key={l} style={[styles.levelChip, level === l && styles.levelActive, l === 0 && styles.newChip, l === 0 && level === l && styles.newChipActive]} onPress={() => setLevel(l)} testID={`level-${l}`}>
              <Text style={[styles.levelText, { color: level === l ? colors.brand : "#fff" }, l === 0 && level !== l && { color: "#fff" }]}>{l === 0 ? "🎁 New" : `L${l}`}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* Sort + refresh */}
      <View style={styles.toolbar}>
        <Pressable style={styles.sortBtn} onPress={() => setAsc((v) => !v)} testID="sort-button">
          <Text style={styles.sortText}>{asc ? "From low to high" : "From high to low"}</Text>
          <Ionicons name={asc ? "chevron-down" : "chevron-up"} size={14} color={colors.onSurface} />
        </Pressable>
        <Pressable style={styles.refreshBtn} onPress={load} testID="refresh-button">
          <Ionicons name="refresh" size={14} color={colors.onSurfaceSecondary} />
          <Text style={styles.refreshText}>Refresh</Text>
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.brand} style={{ marginTop: spacing.xxl }} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
          {isNew && (
            <LinearGradient colors={["#F5A623", "#E8620B"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.newBanner}>
              <Ionicons name="sparkles" size={22} color="#fff" />
              <View style={{ flex: 1 }}>
                <Text style={styles.newBannerT}>New User Special Plans</Text>
                <Text style={styles.newBannerS}>One-time exclusive high-return plans for new members only!</Text>
              </View>
            </LinearGradient>
          )}
          {list.map((t, i) => (
            <Animated.View key={t.task_id} entering={FadeInDown.delay(i * 40)} style={[styles.card, t.new_user && styles.cardNew]} testID={`order-card-${t.task_id}`}>
              {t.new_user && <View style={styles.newTag}><Text style={styles.newTagT}>FOR NEW USERS ONLY</Text></View>}
              <View style={styles.cardBodyRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.orderAmount}>Order amount: {t.amount.toFixed(1)}</Text>
                  <Text style={styles.orderQty}>Order quantity: {t.quantity}</Text>
                  <Text style={styles.reward}>Reward: <Text style={styles.rewardVal}>{t.reward.toFixed(2)}</Text>{t.bonus ? <Text style={styles.bonus}> +{t.bonus.toFixed(1)}</Text> : null}</Text>
                  <View style={styles.codeChip}><Ionicons name="pricetag" size={9} color={colors.onBrandTertiary} /><Text style={styles.codeText}>{t.code}</Text></View>
                </View>
                <View style={styles.rightCol}>
                  <Pressable style={styles.receiveBtn} onPress={() => goPay(t)} testID={`receive-${t.task_id}`}>
                    <Text style={styles.receiveText}>Receive</Text>
                  </Pressable>
                  <Text style={styles.final}>Final: <Text style={styles.finalVal}>{t.final.toFixed(2)} RP</Text></Text>
                </View>
              </View>
            </Animated.View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { backgroundColor: colors.brand, paddingBottom: spacing.md },
  levelRow: { paddingHorizontal: spacing.lg, gap: spacing.sm, alignItems: "center" },
  levelChip: { minWidth: 52, height: 38, borderRadius: radius.pill, paddingHorizontal: spacing.md, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.18)" },
  levelActive: { backgroundColor: "#fff" },
  levelText: { fontFamily: fonts.bold, fontSize: 15 },
  toolbar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  sortBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.surfaceSecondary, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, ...shadow.soft },
  sortText: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: 13 },
  refreshBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.surfaceSecondary, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, ...shadow.soft },
  refreshText: { color: colors.onSurfaceSecondary, fontFamily: fonts.medium, fontSize: 13 },
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.md, ...shadow.soft },
  cardNew: { borderWidth: 2, borderColor: "#E8620B", backgroundColor: "#FFF7EF" },
  cardBodyRow: { flexDirection: "row", alignItems: "center" },
  newTag: { alignSelf: "flex-start", backgroundColor: "#E8620B", borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 3, marginBottom: spacing.md },
  newTagT: { color: "#fff", fontFamily: fonts.bold, fontSize: 10, letterSpacing: 0.5 },
  newBanner: { flexDirection: "row", alignItems: "center", gap: spacing.md, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md, ...shadow.soft },
  newBannerT: { color: "#fff", fontFamily: fonts.bold, fontSize: 16 },
  newBannerS: { color: "rgba(255,255,255,0.92)", fontFamily: fonts.regular, fontSize: 12, marginTop: 2 },
  newChip: { backgroundColor: "#E8620B" },
  newChipActive: { backgroundColor: "#fff" },
  orderAmount: { color: colors.onSurface, fontFamily: fonts.bold, fontSize: 19 },
  orderQty: { color: colors.onSurfaceTertiary, fontFamily: fonts.regular, fontSize: 13, marginTop: 4 },
  reward: { color: colors.onSurfaceTertiary, fontFamily: fonts.regular, fontSize: 13, marginTop: 2 },
  rewardVal: { color: colors.onSurface, fontFamily: fonts.bold, fontSize: 15 },
  bonus: { color: colors.brand, fontFamily: fonts.medium, fontSize: 12 },
  codeChip: { flexDirection: "row", alignItems: "center", gap: 3, alignSelf: "flex-start", backgroundColor: colors.brandTertiary, borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 2, marginTop: spacing.sm },
  codeText: { color: colors.onBrandTertiary, fontFamily: fonts.medium, fontSize: 10, letterSpacing: 0.5 },
  rightCol: { alignItems: "center", gap: spacing.sm },
  receiveBtn: { backgroundColor: colors.brand, borderRadius: radius.sm, paddingHorizontal: spacing.xl, paddingVertical: 11, ...shadow.soft },
  receiveText: { color: "#fff", fontFamily: fonts.semibold, fontSize: 15 },
  final: { color: colors.onSurfaceTertiary, fontFamily: fonts.regular, fontSize: 13 },
  finalVal: { color: colors.brand, fontFamily: fonts.bold, fontSize: 14 },
});
