import { createContext, useContext, useEffect, useState } from "react";
import api from "@/lib/api";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = localStorage.getItem("rk_token");
    if (!t) { setLoading(false); return; }
    api.get("/me").then(r => setUser(r.data)).catch(() => localStorage.removeItem("rk_token")).finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    localStorage.setItem("rk_token", data.token);
    const me = await api.get("/me");
    setUser(me.data);
    return me.data;
  };

  const logout = () => {
    localStorage.removeItem("rk_token");
    setUser(null);
  };

  const refresh = async () => {
    const me = await api.get("/me");
    setUser(me.data);
    return me.data;
  };

  return <AuthCtx.Provider value={{ user, loading, login, logout, refresh, setUser }}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
