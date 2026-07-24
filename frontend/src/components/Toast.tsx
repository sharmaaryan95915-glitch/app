import React, { createContext, useContext, useState, useCallback, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, fonts, radius, spacing } from "@/src/theme";

type ToastType = "success" | "error" | "info";
type ToastCtx = { show: (msg: string, type?: ToastType) => void };

const Ctx = createContext<ToastCtx>({ show: () => {} });
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<{ msg: string; type: ToastType } | null>(null);
  const insets = useSafeAreaInsets();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((msg: string, type: ToastType = "info") => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ msg, type });
    timer.current = setTimeout(() => setToast(null), 2800);
  }, []);

  const iconName =
    toast?.type === "success" ? "checkmark-circle" : toast?.type === "error" ? "alert-circle" : "information-circle";
  const accent =
    toast?.type === "success" ? colors.success : toast?.type === "error" ? colors.error : colors.brand;

  return (
    <Ctx.Provider value={{ show }}>
      {children}
      {toast && (
        <Animated.View
          entering={FadeInUp.springify().damping(18)}
          exiting={FadeOutUp}
          style={[styles.wrap, { top: insets.top + 8 }]}
          testID="toast-message"
        >
          <View style={[styles.toast, { borderColor: accent }]}>
            <Ionicons name={iconName as any} size={20} color={accent} />
            <Text style={styles.text}>{toast.msg}</Text>
          </View>
        </Animated.View>
      )}
    </Ctx.Provider>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: spacing.lg, right: spacing.lg, zIndex: 9999, pointerEvents: "none" },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  text: { color: colors.onSurface, fontFamily: fonts.medium, fontSize: 14, flex: 1 },
});
