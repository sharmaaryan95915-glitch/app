import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { KeyboardStickyView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { api } from "@/src/api";
import { useToast } from "@/src/components/Toast";
import { colors, fonts, radius, spacing } from "@/src/theme";

const FAQS = [
  { q: "How do I earn money?", a: "Pick any task, pay the amount via UPI, upload the payment screenshot. Once admin verifies, your amount + reward is credited to your balance." },
  { q: "When will I get my reward?", a: "Rewards are credited after admin verifies your payment screenshot, usually within a few minutes to a few hours." },
  { q: "How do I withdraw?", a: "Add a payout account (UPI) in Payout Accounts, then request a withdrawal. It is processed after admin approval." },
  { q: "My screenshot was rejected. Why?", a: "Screenshots must be real-time (2–3 minutes old). Old, edited or unclear screenshots are rejected as false declaration." },
  { q: "How does referral work?", a: "Share your referral code. When a friend signs up with it, you earn ₹300 instantly." },
];

export default function Help() {
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);

  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [telegram, setTelegram] = useState<string>("");

  const load = useCallback(async () => {
    try {
      const [m, c] = await Promise.all([api.get("/support/my"), api.get("/config")]);
      setMessages(m.messages || []);
      setTelegram(c.telegram || "");
    } catch {}
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const send = async () => {
    const t = text.trim();
    if (!t) return;
    setText("");
    try {
      const r = await api.post("/support/send", { text: t });
      setMessages((prev) => [...prev, r.message]);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e: any) {
      toast.show(e.message || "Failed to send", "error");
    }
  };

  const openTelegram = () => {
    if (telegram) Linking.openURL(telegram);
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/profile"))} style={styles.backBtn} testID="help-back-button">
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Help & Support</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={{ padding: spacing.xl, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        <Pressable style={styles.telegramBtn} onPress={openTelegram} testID="telegram-button">
          <Ionicons name="paper-plane" size={20} color="#fff" />
          <View style={{ flex: 1 }}>
            <Text style={styles.telegramTitle}>Join our Telegram</Text>
            <Text style={styles.telegramSub}>Fast support & updates</Text>
          </View>
          <Ionicons name="open-outline" size={18} color="#fff" />
        </Pressable>

        <Text style={styles.sectionTitle}>Frequently Asked</Text>
        {FAQS.map((f, i) => (
          <Pressable key={i} style={styles.faq} onPress={() => setOpenFaq(openFaq === i ? null : i)} testID={`faq-${i}`}>
            <View style={styles.faqTop}>
              <Text style={styles.faqQ}>{f.q}</Text>
              <Ionicons name={openFaq === i ? "chevron-up" : "chevron-down"} size={18} color={colors.muted} />
            </View>
            {openFaq === i && <Text style={styles.faqA}>{f.a}</Text>}
          </Pressable>
        ))}

        <Text style={styles.sectionTitle}>Chat with Support</Text>
        <View style={styles.chatBox}>
          {loading ? (
            <ActivityIndicator color={colors.brand} style={{ marginVertical: spacing.lg }} />
          ) : messages.length === 0 ? (
            <Text style={styles.chatEmpty}>Send us a message and our support team will reply here.</Text>
          ) : (
            messages.map((m) => (
              <View key={m.msg_id} style={[styles.bubble, m.sender === "user" ? styles.bubbleUser : styles.bubbleAdmin]}>
                {m.sender === "admin" && <Text style={styles.bubbleName}>Support</Text>}
                <Text style={[styles.bubbleText, m.sender === "user" && { color: colors.onBrandPrimary }]}>{m.text}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <KeyboardStickyView offset={{ closed: 0, opened: insets.bottom }}>
        <View style={[styles.inputBar, { paddingBottom: insets.bottom + spacing.md }]}>
          <TextInput
            style={styles.input}
            placeholder="Type your issue..."
            placeholderTextColor={colors.muted}
            value={text}
            onChangeText={setText}
            testID="support-input"
          />
          <Pressable style={styles.sendBtn} onPress={send} testID="support-send-button">
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
  headerTitle: { color: colors.onSurface, fontFamily: fonts.displaySemi, fontSize: 18 },
  telegramBtn: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: "#229ED9", borderRadius: radius.md, padding: spacing.lg },
  telegramTitle: { color: "#fff", fontFamily: fonts.semibold, fontSize: 16 },
  telegramSub: { color: "rgba(255,255,255,0.85)", fontFamily: fonts.regular, fontSize: 12, marginTop: 2 },
  sectionTitle: { color: colors.onSurface, fontFamily: fonts.displaySemi, fontSize: 18, marginTop: spacing.xl, marginBottom: spacing.md },
  faq: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, marginBottom: spacing.md },
  faqTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  faqQ: { flex: 1, color: colors.onSurface, fontFamily: fonts.medium, fontSize: 15 },
  faqA: { color: colors.onSurfaceTertiary, fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, marginTop: spacing.sm },
  chatBox: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, minHeight: 120 },
  chatEmpty: { color: colors.muted, fontFamily: fonts.regular, fontSize: 13, textAlign: "center", padding: spacing.lg },
  bubble: { maxWidth: "82%", borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
  bubbleUser: { alignSelf: "flex-end", backgroundColor: colors.brand },
  bubbleAdmin: { alignSelf: "flex-start", backgroundColor: colors.surfaceTertiary },
  bubbleName: { color: colors.brand, fontFamily: fonts.semibold, fontSize: 11, marginBottom: 2 },
  bubbleText: { color: colors.onSurface, fontFamily: fonts.regular, fontSize: 14 },
  inputBar: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.md, backgroundColor: colors.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  input: { flex: 1, height: 48, backgroundColor: colors.surfaceSecondary, borderRadius: radius.pill, paddingHorizontal: spacing.lg, color: colors.onSurface, fontFamily: fonts.regular, fontSize: 15, borderWidth: 1, borderColor: colors.border },
  sendBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
});
