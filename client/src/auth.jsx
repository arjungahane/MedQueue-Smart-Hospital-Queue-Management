import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import api from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('medqueue-user') || 'null'); } catch { return null; }
  });

  const signIn = useCallback(async (credentials) => {
    const { data } = await api.post('/auth/login', credentials);
    localStorage.setItem('medqueue-token', data.data.token);
    localStorage.setItem('medqueue-user', JSON.stringify(data.data.user));
    setUser(data.data.user);
    return data.data.user;
  }, []);

  const register = useCallback(async (input) => {
    const { data } = await api.post('/auth/register', input);
    localStorage.setItem('medqueue-token', data.data.token);
    localStorage.setItem('medqueue-user', JSON.stringify(data.data.user));
    setUser(data.data.user);
    return data.data.user;
  }, []);

  const signOut = useCallback(async () => {
    try { if (localStorage.getItem('medqueue-token')) await api.post('/auth/logout'); }
    finally {
      localStorage.removeItem('medqueue-token');
      localStorage.removeItem('medqueue-user');
      setUser(null);
    }
  }, []);

  const value = useMemo(() => ({ user, signIn, register, signOut }), [user, signIn, register, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within AuthProvider.');
  return value;
}
