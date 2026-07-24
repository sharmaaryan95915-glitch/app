import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { Platform } from "react-native";

import { api, TOKEN_KEY } from "@/src/api";
import { storage } from "@/src/utils/storage";

export type User = {
  user_id: string;
  email: string;
  name: string;
  role: "user" | "admin";
  balance: number;
  total_earned: number;
  referral_code: string;
  referred_by: string | null;
  picture: string | null;
  auth_provider: string;
  created_at: string;
};

type AuthContextType = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, referralCode?: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setUser: (u: User | null) => void;
};

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const loadMe = useCallback(async () => {
    const token = await storage.secureGet(TOKEN_KEY, "");
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const data = await api.get<{ user: User }>("/auth/me");
      setUser(data.user);
    } catch {
      await storage.secureRemove(TOKEN_KEY);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  const persist = async (token: string, u: User) => {
    await storage.secureSet(TOKEN_KEY, token);
    setUser(u);
  };

  const login = async (email: string, password: string) => {
    const data = await api.post<{ token: string; user: User }>(
      "/auth/login",
      { email, password },
      false,
    );
    await persist(data.token, data.user);
  };

  const register = async (name: string, email: string, password: string, referralCode?: string) => {
    const data = await api.post<{ token: string; user: User }>(
      "/auth/register",
      { name, email, password, referral_code: referralCode || null },
      false,
    );
    await persist(data.token, data.user);
  };

  const loginWithGoogle = async () => {
    const redirectUrl =
      Platform.OS === "web" ? window.location.origin + "/" : Linking.createURL("");
    const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;

    if (Platform.OS === "web") {
      window.location.href = authUrl;
      return;
    }

    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
    if (result.type !== "success" || !result.url) {
      throw new Error("Google sign-in cancelled");
    }
    const url = result.url;
    let sessionId: string | null = null;
    const hashMatch = url.match(/[#&]session_id=([^&]+)/);
    const queryMatch = url.match(/[?&]session_id=([^&]+)/);
    if (hashMatch) sessionId = decodeURIComponent(hashMatch[1]);
    else if (queryMatch) sessionId = decodeURIComponent(queryMatch[1]);
    if (!sessionId) throw new Error("Could not read Google session");

    const data = await api.post<{ token: string; user: User }>(
      "/auth/google-session",
      { session_token: sessionId },
      false,
    );
    await persist(data.token, data.user);
  };

  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch {}
    await storage.secureRemove(TOKEN_KEY);
    setUser(null);
  };

  const refreshUser = async () => {
    try {
      const data = await api.get<{ user: User }>("/auth/me");
      setUser(data.user);
    } catch {}
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, login, register, loginWithGoogle, logout, refreshUser, setUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}
