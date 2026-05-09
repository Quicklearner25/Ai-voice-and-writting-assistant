import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { authApi, setAuthToken } from "../services/api";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => localStorage.getItem("jewellery_token"));
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("jewellery_user");
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(Boolean(token));

  useEffect(() => {
    setAuthToken(token);
    if (!token) {
      setLoading(false);
      return undefined;
    }
    let mounted = true;
    authApi
      .me()
      .then((profile) => {
        if (mounted) {
          setUser(profile);
          localStorage.setItem("jewellery_user", JSON.stringify(profile));
        }
      })
      .catch(() => {
        if (mounted) logout();
      })
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [token]);

  useEffect(() => {
    const handler = () => logout();
    window.addEventListener("auth:expired", handler);
    return () => window.removeEventListener("auth:expired", handler);
  }, []);

  const login = async (credentials) => {
    const data = await authApi.login(credentials);
    localStorage.setItem("jewellery_token", data.token);
    localStorage.setItem("jewellery_user", JSON.stringify(data.user));
    setAuthToken(data.token);
    setToken(data.token);
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem("jewellery_token");
    localStorage.removeItem("jewellery_user");
    setAuthToken(null);
    setToken(null);
    setUser(null);
  };

  const value = useMemo(
    () => ({
      token,
      user,
      loading,
      isAuthenticated: Boolean(token && user),
      login,
      logout,
      hasRole: (...roles) => Boolean(user && roles.includes(user.role)),
    }),
    [token, user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
