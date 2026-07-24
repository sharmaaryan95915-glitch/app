import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from "react-native";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";

import { colors, fonts, radius, spacing } from "@/src/theme";

export function GlassCard({
  children,
  style,
  intensity = 24,
  testID,
}: {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  intensity?: number;
  testID?: string;
}) {
  return (
    <View style={[styles.glassWrap, style]} testID={testID}>
      <BlurView intensity={intensity} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={styles.glassTint} />
      <View style={styles.glassInner}>{children}</View>
    </View>
  );
}

export function GoldButton({
  label,
  onPress,
  loading,
  disabled,
  variant = "primary",
  icon,
  testID,
  style,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: "primary" | "outline" | "success" | "danger";
  icon?: keyof typeof Ionicons.glyphMap;
  testID?: string;
  style?: ViewStyle;
}) {
  const isDisabled = disabled || loading;
  const bg =
    variant === "primary"
      ? colors.brand
      : variant === "success"
      ? colors.success
      : variant === "danger"
      ? colors.error
      : "transparent";
  const fg = variant === "outline" ? colors.brand : variant === "primary" ? colors.onBrandPrimary : "#FFFFFF";
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg, opacity: isDisabled ? 0.55 : pressed ? 0.85 : 1 },
        variant === "outline" && styles.btnOutline,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.btnRow}>
          {icon && <Ionicons name={icon} size={18} color={fg} />}
          <Text style={[styles.btnLabel, { color: fg }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function Field({
  label,
  icon,
  style,
  ...rest
}: TextInputProps & { label?: string; icon?: keyof typeof Ionicons.glyphMap; style?: ViewStyle }) {
  return (
    <View style={style}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <View style={styles.fieldWrap}>
        {icon && <Ionicons name={icon} size={18} color={colors.muted} style={{ marginRight: spacing.sm }} />}
        <TextInput
          placeholderTextColor={colors.muted}
          style={styles.input}
          {...rest}
        />
      </View>
    </View>
  );
}

export function Chip({
  label,
  active,
  onPress,
  testID,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={[styles.chip, active ? styles.chipActive : styles.chipInactive]}
    >
      <Text style={[styles.chipText, { color: active ? colors.onBrandPrimary : colors.onSurfaceSecondary }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  glassWrap: {
    borderRadius: radius.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "rgba(30,30,30,0.6)",
  },
  glassTint: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(30,30,30,0.55)" },
  glassInner: { padding: spacing.lg },
  btn: {
    height: 54,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  btnOutline: { borderWidth: 1, borderColor: colors.brand },
  btnRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  btnLabel: { fontFamily: fonts.semibold, fontSize: 16 },
  fieldLabel: {
    color: colors.onSurfaceTertiary,
    fontFamily: fonts.medium,
    fontSize: 13,
    marginBottom: spacing.sm,
  },
  fieldWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    height: 54,
  },
  input: { flex: 1, color: colors.onSurface, fontFamily: fonts.regular, fontSize: 16 },
  chip: {
    height: 36,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  chipActive: { backgroundColor: colors.brand },
  chipInactive: { backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  chipText: { fontFamily: fonts.medium, fontSize: 13 },
});
