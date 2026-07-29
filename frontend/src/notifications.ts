import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

const REMINDERS = [
  { title: "💰 Your money should be working!", body: "Invest now and earn up to 15% profit. Don't miss today's high-return plans." },
  { title: "🔥 Big profits waiting for you", body: "Users are earning ₹1050+ on a single order. Ready to invest a bigger amount?" },
  { title: "⏳ Limited time boost", body: "Higher levels = higher rewards. Top up now and grow your balance fast." },
  { title: "🚀 Turn ₹10,000 into ₹11,050", body: "New user special plans give huge returns. Invest before they're gone!" },
  { title: "🎯 Keep the streak going", body: "Complete another task today and watch your earnings climb. Invest now!" },
];

// Local scheduled reminders (work on real device builds; limited in Expo Go).
export async function setupInvestReminders() {
  try {
    if (Platform.OS === "web") return;

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });

    // Android 13+ requires a notification channel before requesting permission
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("invest-reminders", {
        name: "Invest Reminders",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#0BA36B",
      });
    }

    const settings = await Notifications.getPermissionsAsync();
    let granted = settings.granted;
    if (!granted && settings.canAskAgain) {
      const req = await Notifications.requestPermissionsAsync();
      granted = req.granted;
    }
    if (!granted) return;

    // Avoid stacking duplicates
    await Notifications.cancelAllScheduledNotificationsAsync();

    // Repeating hourly reminder
    const pick = REMINDERS[Math.floor(Math.random() * REMINDERS.length)];
    await Notifications.scheduleNotificationAsync({
      content: {
        title: pick.title,
        body: pick.body,
        ...(Platform.OS === "android" ? { channelId: "invest-reminders" } : {}),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 3600,
        repeats: true,
        ...(Platform.OS === "android" ? { channelId: "invest-reminders" } : {}),
      },
    });
  } catch {
    // no-op (Expo Go / web limitations)
  }
}
