// Victory Pay — Luxe DARK theme tokens (from design_guidelines.json)

export const colors = {
  surface: "#121212",
  onSurface: "#FFFFFF",
  surfaceSecondary: "#1E1E1E",
  onSurfaceSecondary: "#E0E0E0",
  surfaceTertiary: "#2C2C2C",
  onSurfaceTertiary: "#BDBDBD",
  surfaceInverse: "#FFFFFF",
  onSurfaceInverse: "#121212",
  brand: "#D4AF37",
  brandPrimary: "#D4AF37",
  onBrandPrimary: "#121212",
  brandSecondary: "#AA8C2C",
  brandTertiary: "#4A3E15",
  onBrandTertiary: "#E2C86F",
  success: "#059669",
  onSuccess: "#FFFFFF",
  warning: "#D97706",
  error: "#DC2626",
  onError: "#FFFFFF",
  info: "#0D9488",
  border: "#2C2C2C",
  borderStrong: "#4A4A4A",
  divider: "#1E1E1E",
  muted: "#8A8A8A",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

export const radius = {
  sm: 6,
  md: 12,
  lg: 20,
  pill: 999,
};

export const fonts = {
  display: "Fraunces-Bold",
  displaySemi: "Fraunces-SemiBold",
  regular: "Geist-Regular",
  medium: "Geist-Medium",
  semibold: "Geist-SemiBold",
};

export const IMAGES = {
  logo:
    "https://images.unsplash.com/photo-1714548474550-d533620651c7?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDk1NzZ8MHwxfHNlYXJjaHwxfHxwcmVtaXVtJTIwZ29sZCUyMFYlMjBsb2dvJTIwdHJhbnNwYXJlbnR8ZW58MHx8fHwxNzg0ODc3MDUxfDA&ixlib=rb-4.1.0&q=85",
  heroBg:
    "https://images.unsplash.com/photo-1761437855740-c894da924d79?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA2MTJ8MHwxfHNlYXJjaHwyfHxhYnN0cmFjdCUyMGRhcmslMjBncmVlbiUyMGdvbGQlMjBnZW9tZXRyaWMlMjB0ZXh0dXJlfGVufDB8fHx8MTc4NDg3NzA1MXww&ixlib=rb-4.1.0&q=85",
  emptyWallet:
    "https://images.pexels.com/photos/6289030/pexels-photo-6289030.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
};

export const money = (n: number | undefined | null): string => {
  const v = Number(n ?? 0);
  return "₹" + v.toLocaleString("en-IN", { maximumFractionDigits: 2 });
};
