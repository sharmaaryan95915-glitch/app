import { Tabs } from "expo-router";
import { Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { colors, fonts, shadow } from "@/src/theme";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          position: "absolute",
          left: 14,
          right: 14,
          bottom: Platform.OS === "ios" ? 26 : 16,
          height: 66,
          borderRadius: 22,
          borderTopWidth: 0,
          backgroundColor: colors.surfaceSecondary,
          paddingTop: 8,
          paddingBottom: 8,
          ...shadow.card,
        },
        tabBarItemStyle: { borderRadius: 16 },
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 11, marginTop: 2 },
        tabBarBackground: () => null,
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home", tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} /> }} />
      <Tabs.Screen name="plans" options={{ title: "Buy RP", tabBarIcon: ({ color, size }) => <Ionicons name="trending-up" size={size} color={color} /> }} />
      <Tabs.Screen name="referrals" options={{ title: "Sell RP", tabBarIcon: ({ color, size }) => <Ionicons name="wallet" size={size} color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: "Mine", tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} /> }} />
    </Tabs>
  );
}
