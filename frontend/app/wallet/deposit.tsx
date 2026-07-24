import { Redirect } from "expo-router";

// Manual deposit is deprecated — deposits now happen via task payment (QR) flow.
export default function DepositRedirect() {
  return <Redirect href="/(tabs)/plans" />;
}
