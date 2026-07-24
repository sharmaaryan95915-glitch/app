import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { KeyboardStickyView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { api } from "@/src/api";
import { useToast } from "@/src/components/Toast";
import { colors, fonts, radius, spacing } from "@/src/theme";

export default function AdminSupportThread() {
  const params = useLocalSearchParams<{ userId: string; name: string }>();
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);

  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const r = await api.get(`/admin/support/${params.userId}`);
      setMessages(r.messages || []);
    } catch {}
    setLoading(false);
  }, [params.userId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const send = async () => {
    const t = text.trim();
    if (!t) return;
    setText("");
    try {
      const r = await api.post(`/admin/support/${params.userId}`, { text: t });
      setMessages((prev) => [...prev, r.message]);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e: any) {
      toast.show(e.message || "Failed", "error");
    }
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/admin"))} style={styles.backBtn} testID="admin-support-back">
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>{params.name || "Support"}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={{ padding: spacing.xl, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        {loading ? (
          <ActivityIndicator color={colors.brand} style={{ marginTop: spacing.xl }} />
        ) : (
          messages.map((m) => (
            <View key={m.msg_id} style={[styles.bubble, m.sender === "admin" ? styles.bubbleAdmin : styles.bubbleUser]}>
              <Text style={[styles.bubbleText, m.sender === "admin" && { color: colors.onBrandPrimary }]}>{m.text}</Text>
            </View>
          ))
        )}
      </ScrollView>

      <KeyboardStickyView offset={{ closed: 0, opened: insets.bottom }}>
        <View style={[styles.inputBar, { paddingBottom: insets.bottom + spacing.md }]}>
          <TextInput style={styles.input} placeholder="Reply to user..." placeholderTextColor={colors.muted} value={text} onChangeText={setText} testID="admin-reply-input" />
          <Pressable style={styles.sendBtn} onPress={send} testID="admin-reply-send">
            <Ionicons name="send" size={18} color={colors.onBrandPrimary} />
          </Pressable>
        </View>
      </KeyboardStickyView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, textAlign: "center", color: colors.onSurface, fontFamily: fonts.displaySemi, fontSize: 18 },
  bubble: { maxWidth: "82%", borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
  bubbleAdmin: { alignSelf: "flex-end", backgroundColor: colors.brand },
  bubbleUser: { alignSelf: "flex-start", backgroundColor: colors.surfaceTertiary },
  bubbleText: { color: colors.onSurface, fontFamily: fonts.regular, fontSize: 14 },
  inputBar: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.md, backgroundColor: colors.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  input: { flex: 1, height: 48, backgroundColor: colors.surfaceSecondary, borderRadius: radius.pill, paddingHorizontal: spacing.lg, color: colors.onSurface, fontFamily: fonts.regular, fontSize: 15, borderWidth: 1, borderColor: colors.border },
  sendBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
});
