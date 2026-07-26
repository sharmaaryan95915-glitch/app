// Victory Pay — LIGHT green fintech theme (RynPay-style reference)

export const colors = {
  surface: "#F2F3F7",
  onSurface: "#141821",
  surfaceSecondary: "#FFFFFF",
  onSurfaceSecondary: "#3A3F4A",
  surfaceTertiary: "#EEF0F4",
  onSurfaceTertiary: "#6B7280",
  surfaceInverse: "#141821",
  onSurfaceInverse: "#FFFFFF",

  brand: "#0BA36B",
  brandPrimary: "#0BA36B",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#0A8F5E",
  brandTertiary: "#E3F5EC",
  onBrandTertiary: "#0A7D53",

  accent: "#2F6BFF",
  accentTint: "#E8EEFF",
  onAccent: "#FFFFFF",

  success: "#0BA36B",
  onSuccess: "#FFFFFF",
  warning: "#E2A100",
  error: "#E23744",
  onError: "#FFFFFF",
  info: "#2F6BFF",

  border: "#E6E8EE",
  borderStrong: "#D1D5DB",
  divider: "#EEF0F4",
  muted: "#9AA1AC",
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
  sm: 8,
  md: 14,
  lg: 20,
  pill: 999,
};

export const fonts = {
  display: "Geist-Bold",
  displaySemi: "Geist-SemiBold",
  regular: "Geist-Regular",
  medium: "Geist-Medium",
  semibold: "Geist-SemiBold",
  bold: "Geist-Bold",
};

export const shadow = {
  card: {
    shadowColor: "#1B2733",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
  soft: {
    shadowColor: "#1B2733",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
};

export const IMAGES = {
  heroBg:
    "https://images.unsplash.com/photo-1761437855740-c894da924d79?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200",
  emptyWallet:
    "https://images.pexels.com/photos/6289030/pexels-photo-6289030.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
};

export const money = (n: number | undefined | null): string => {
  const v = Number(n ?? 0);
  return "₹" + v.toLocaleString("en-IN", { maximumFractionDigits: 2 });
};

export const rp = (n: number | undefined | null): string => {
  const v = Number(n ?? 0);
  return v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " RP";
};
