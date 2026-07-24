import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "@/src/context/AuthContext";
import { useToast } from "@/src/components/Toast";
import { Field, GoldButton } from "@/src/components/ui";
import { colors, fonts, radius, spacing } from "@/src/theme";

export default function Login() {
  const { login, loginWithGoogle } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [gLoading, setGLoading] = useState(false);

  const onLogin = async () => {
    if (!email.trim() || !password) {
      toast.show("Enter email and password", "error");
      return;
    }
    setLoading(true);
    try {
      await login(email.trim(), password);
      router.replace("/(tabs)");
    } catch (e: any) {
      toast.show(e.message || "Login failed", "error");
    } finally {
      setLoading(false);
    }
  };

  const onGoogle = async () => {
    setGLoading(true);
    try {
      await loginWithGoogle();
      router.replace("/(tabs)");
    } catch (e: any) {
      toast.show(e.message || "Google sign-in failed", "error");
    } finally {
      setGLoading(false);
    }
  };

  return (
    <KeyboardAwareScrollView
      style={{ flex: 1, backgroundColor: colors.surface }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xl }]}
      bottomOffset={24}
      showsVerticalScrollIndicator={false}
    >
      <Pressable style={styles.back} onPress={() => router.replace("/")} testID="login-back-button">
        <Ionicons name="chevron-back" size={22} color={colors.onSurfaceTertiary} />
        <Text style={styles.backText}>Back</Text>
      </Pressable>

      <View style={styles.logoWrap}>
        <Text style={styles.logoV}>V</Text>
      </View>
      <Text style={styles.brand}>Victory Pay</Text>
      <Text style={styles.title}>Welcome back</Text>
      <Text style={styles.subtitle}>Enter your email and password to continue.</Text>

      <View style={{ height: spacing.xl }} />

      <Field
        label="Email"
        icon="mail-outline"
        placeholder="you@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        value={email}
        onChangeText={setEmail}
        testID="login-email-input"
        style={{ marginBottom: spacing.lg }}
      />
      <Field
        label="Password"
        icon="lock-closed-outline"
        placeholder="••••••••"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        testID="login-password-input"
        style={{ marginBottom: spacing.xl }}
      />

      <GoldButton label="Sign in" onPress={onLogin} loading={loading} testID="login-submit-button" />

      <View style={styles.divider}>
        <View style={styles.line} />
        <Text style={styles.dividerText}>or</Text>
        <View style={styles.line} />
      </View>

      <GoldButton
        label="Continue with Google"
        variant="outline"
        icon="logo-google"
        onPress={onGoogle}
        loading={gLoading}
        testID="login-google-button"
      />

      <View style={styles.footer}>
        <Text style={styles.footerText}>Don&apos;t have an account? </Text>
        <Pressable onPress={() => router.replace("/(auth)/register")} testID="go-to-register-button">
          <Text style={styles.footerLink}>Create account</Text>
        </Pressable>
      </View>
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.xl },
  back: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", marginBottom: spacing.lg },
  backText: { color: colors.onSurfaceTertiary, fontFamily: fonts.medium, fontSize: 14 },
  logoWrap: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  logoV: { color: colors.onBrandPrimary, fontFamily: fonts.display, fontSize: 30 },
  brand: { color: colors.brand, fontFamily: fonts.displaySemi, fontSize: 18, marginTop: spacing.md },
  title: { color: colors.onSurface, fontFamily: fonts.display, fontSize: 30, marginTop: spacing.lg },
  subtitle: { color: colors.onSurfaceTertiary, fontFamily: fonts.regular, fontSize: 14, marginTop: spacing.xs },
  divider: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginVertical: spacing.xl },
  line: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { color: colors.muted, fontFamily: fonts.regular, fontSize: 13 },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: spacing.xl },
  footerText: { color: colors.onSurfaceTertiary, fontFamily: fonts.regular, fontSize: 14 },
  footerLink: { color: colors.brand, fontFamily: fonts.semibold, fontSize: 14 },
});
