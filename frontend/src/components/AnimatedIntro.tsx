import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";

import { colors, fonts } from "@/src/theme";

export function AnimatedIntro({ onDone }: { onDone: () => void }) {
  const logoScale = useSharedValue(0.4);
  const logoOpacity = useSharedValue(0);
  const ringScale = useSharedValue(0.6);
  const ringOpacity = useSharedValue(0);
  const textY = useSharedValue(20);
  const textOpacity = useSharedValue(0);
  const rootOpacity = useSharedValue(1);
  const shimmer = useSharedValue(-1);

  useEffect(() => {
    logoOpacity.value = withTiming(1, { duration: 500 });
    logoScale.value = withSequence(
      withTiming(1.08, { duration: 620, easing: Easing.out(Easing.back(2)) }),
      withTiming(1, { duration: 220 }),
    );
    ringOpacity.value = withDelay(200, withTiming(1, { duration: 500 }));
    ringScale.value = withDelay(200, withRepeat(withTiming(1.25, { duration: 1400, easing: Easing.out(Easing.ease) }), -1, false));
    textOpacity.value = withDelay(650, withTiming(1, { duration: 500 }));
    textY.value = withDelay(650, withTiming(0, { duration: 600, easing: Easing.out(Easing.exp) }));
    shimmer.value = withDelay(700, withRepeat(withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.ease) }), -1, false));

    rootOpacity.value = withDelay(
      2400,
      withTiming(0, { duration: 450 }, (finished) => {
        if (finished) runOnJS(onDone)();
      }),
    );
  }, []);

  const rootStyle = useAnimatedStyle(() => ({ opacity: rootOpacity.value }));
  const logoStyle = useAnimatedStyle(() => ({ opacity: logoOpacity.value, transform: [{ scale: logoScale.value }] }));
  const ringStyle = useAnimatedStyle(() => ({ opacity: ringOpacity.value * 0.5, transform: [{ scale: ringScale.value }] }));
  const textStyle = useAnimatedStyle(() => ({ opacity: textOpacity.value, transform: [{ translateY: textY.value }] }));
  const shimmerStyle = useAnimatedStyle(() => ({ transform: [{ translateX: -120 + shimmer.value * 240 }] }));

  return (
    <Animated.View style={[styles.root, rootStyle]} pointerEvents="none" testID="intro-animation">
      <LinearGradient colors={["#161206", colors.surface, "#0c0c0c"]} style={StyleSheet.absoluteFill} />
      <View style={styles.center}>
        <Animated.View style={[styles.ring, ringStyle]} />
        <Animated.View style={[styles.logo, logoStyle]}>
          <Text style={styles.logoText}>V</Text>
          <Animated.View style={[styles.shimmer, shimmerStyle]}>
            <LinearGradient
              colors={["transparent", "rgba(255,255,255,0.55)", "transparent"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </Animated.View>
        <Animated.View style={textStyle}>
          <Text style={styles.brand}>VICTORY PAY</Text>
          <Text style={styles.tag}>PREMIUM REWARDS WALLET</Text>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, zIndex: 1000, alignItems: "center", justifyContent: "center" },
  center: { alignItems: "center" },
  ring: { position: "absolute", top: -18, width: 150, height: 150, borderRadius: 75, borderWidth: 2, borderColor: colors.brand },
  logo: {
    width: 110,
    height: 110,
    borderRadius: 28,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  logoText: { color: colors.onBrandPrimary, fontFamily: fonts.display, fontSize: 62 },
  shimmer: { position: "absolute", top: 0, bottom: 0, width: 60 },
  brand: { color: colors.onSurface, fontFamily: fonts.display, fontSize: 30, letterSpacing: 3, marginTop: 28, textAlign: "center" },
  tag: { color: colors.brand, fontFamily: fonts.medium, fontSize: 11, letterSpacing: 4, marginTop: 8, textAlign: "center" },
});
