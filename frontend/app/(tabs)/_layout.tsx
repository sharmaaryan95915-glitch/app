import { Tabs } from "expo-router";
import { BlurView } from "expo-blur";
import { Platform, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { colors, fonts } from "@/src/theme";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          position: "absolute",
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
          backgroundColor: Platform.OS === "android" ? colors.surfaceSecondary : "transparent",
          elevation: 0,
          height: 64 + (Platform.OS === "ios" ? 20 : 0),
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 11 },
        tabBarBackground: () =>
          Platform.OS === "ios" ? (
            <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.surfaceSecondary }]} />
          ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="plans"
        options={{
          title: "Plans",
          tabBarIcon: ({ color, size }) => <Ionicons name="layers" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="referrals"
        options={{
          title: "Referrals",
          tabBarIcon: ({ color, size }) => <Ionicons name="people" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
