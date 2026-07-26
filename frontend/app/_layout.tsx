import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { LogBox, View } from "react-native";
import { useFonts } from "expo-font";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { StatusBar } from "expo-status-bar";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { AuthProvider, useAuth } from "@/src/context/AuthContext";
import { ToastProvider } from "@/src/components/Toast";
import { AnimatedIntro } from "@/src/components/AnimatedIntro";
import { Onboarding } from "@/src/components/Onboarding";
import { setupInvestReminders } from "@/src/notifications";
import { storage } from "@/src/utils/storage";
import { colors } from "@/src/theme";

LogBox.ignoreAllLogs(true);
SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    if (loading) return;
    const seg0 = segments[0];
    const inAuth = seg0 === "(auth)";
    const onLanding = seg0 === undefined || seg0 === "index";

    if (!user && !inAuth && !onLanding) {
      router.replace("/(auth)/login");
    } else if (user && (inAuth || onLanding)) {
      router.replace("/(tabs)");
    }
  }, [user, loading, segments, router]);

  // First-time onboarding for regular users
  useEffect(() => {
    if (loading || !user || user.role === "admin") {
      setShowOnboarding(false);
      return;
    }
    let active = true;
    (async () => {
      const seen = await storage.getItem(`onboarding_seen_${user.user_id}`, false);
      if (active && !seen) setShowOnboarding(true);
    })();
    return () => { active = false; };
  }, [user, loading]);

  const finishOnboarding = async () => {
    if (user) await storage.setItem(`onboarding_seen_${user.user_id}`, true);
    setShowOnboarding(false);
  };

  return (
    <>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="payment/[taskId]" options={{ presentation: "card" }} />
        <Stack.Screen name="orders" options={{ presentation: "card" }} />
        <Stack.Screen name="accounts" options={{ presentation: "card" }} />
        <Stack.Screen name="help" options={{ presentation: "card" }} />
        <Stack.Screen name="wallet/withdraw" options={{ presentation: "card" }} />
        <Stack.Screen name="wallet/history" options={{ presentation: "card" }} />
        <Stack.Screen name="admin/index" options={{ presentation: "card" }} />
        <Stack.Screen name="admin/support/[userId]" options={{ presentation: "card" }} />
      </Stack>
      {showOnboarding && <Onboarding onDone={finishOnboarding} />}
    </>
  );
}

export default function RootLayout() {
  const [iconsLoaded, iconsError] = useIconFonts();
  const [introDone, setIntroDone] = useState(false);
  const [fontsLoaded, fontsError] = useFonts({
    "Fraunces-Bold": require("../assets/fonts/Fraunces-Bold.ttf"),
    "Fraunces-SemiBold": require("../assets/fonts/Fraunces-SemiBold.ttf"),
    "Geist-Bold": require("../assets/fonts/Geist-Bold.ttf"),
    "Geist-Regular": require("../assets/fonts/Geist-Regular.ttf"),
    "Geist-Medium": require("../assets/fonts/Geist-Medium.ttf"),
    "Geist-SemiBold": require("../assets/fonts/Geist-SemiBold.ttf"),
  });

  const iconsReady = iconsLoaded || iconsError;
  const fontsReady = fontsLoaded || fontsError;

  useEffect(() => {
    if (iconsReady && fontsReady) {
      SplashScreen.hideAsync();
    }
  }, [iconsReady, fontsReady]);

  useEffect(() => {
    setupInvestReminders();
  }, []);

  if (!iconsReady || !fontsReady) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.surface }}>
      <KeyboardProvider>
      <SafeAreaProvider>
        <BottomSheetModalProvider>
          <AuthProvider>
            <ToastProvider>
              <StatusBar style="dark" />
              <View style={{ flex: 1, backgroundColor: colors.surface }}>
                <RootNavigator />
              </View>
              {!introDone && <AnimatedIntro onDone={() => setIntroDone(true)} />}
            </ToastProvider>
          </AuthProvider>
        </BottomSheetModalProvider>
      </SafeAreaProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
