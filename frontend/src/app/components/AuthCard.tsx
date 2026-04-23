"use client";

import { useState } from 'react';
import { api, User } from '../api';

interface AuthCardProps {
  onAuthSuccess: (user: User) => void;
}

export default function AuthCard({ onAuthSuccess }: AuthCardProps) {
  const [isSignup, setIsSignup] = useState(false);
  const [authData, setAuthData] = useState({ username: '', password: '', email: '', role: 'Operator' });
  const [authError, setAuthError] = useState("");
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthenticating(true);
    setAuthError("");

    try {
      let res;
      if (isSignup) {
        res = await api.signup(authData.username, authData.password, authData.email, authData.role);
      } else {
        res = await api.login(authData.username, authData.password);
      }

      if (res.user) {
        onAuthSuccess(res.user);
      }
    } catch (e: any) {
      setAuthError(e.message || "Authentication failed");
    } finally {
      setIsAuthenticating(false);
    }
  };

  return (
    <div className="w-full max-w-sm glass-card border-white/5 shadow-2xl">
      <div className="text-center mb-8">
        <span className="text-5xl mb-4 block">🤖</span>
        <h1 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
          InvoSync AI
        </h1>
        <p className="text-zinc-300 text-sm mt-2 font-medium">
          {isSignup ? "Create your professional account" : "Sign in to your workplace"}
        </p>
      </div>

      <form onSubmit={handleAuth} className="space-y-4">
        <div>
          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block mb-1">Username</label>
          <input
            type="text" required
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none transition-all"
            value={authData.username}
            onChange={e => setAuthData({ ...authData, username: e.target.value })}
          />
        </div>
        {isSignup && (
          <>
            <div>
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block mb-1">Email (Optional)</label>
              <input
                type="email"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none transition-all"
                value={authData.email}
                onChange={e => setAuthData({ ...authData, email: e.target.value })}
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block mb-1">Role</label>
              <select
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none transition-all"
                value={authData.role}
                onChange={e => setAuthData({ ...authData, role: e.target.value })}
              >
                <option value="Operator">Invoicing Operator</option>
                <option value="Manager">Financial Manager</option>
                <option value="Admin">System Admin</option>
              </select>
            </div>
          </>
        )}
        <div>
          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block mb-1">Password</label>
          <input
            type="password" required
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none transition-all"
            value={authData.password}
            onChange={e => setAuthData({ ...authData, password: e.target.value })}
          />
        </div>

        {authError && <p className="text-red-400 text-xs text-center font-medium">{authError}</p>}

        <button
          type="submit" disabled={isAuthenticating}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg shadow-blue-500/20"
        >
          {isAuthenticating ? "Processing..." : (isSignup ? "Create Account" : "Sign In")}
        </button>

        <div className="text-center mt-6">
          <button
            type="button"
            onClick={() => setIsSignup(!isSignup)}
            className="text-zinc-300 hover:text-blue-400 text-xs font-medium transition-colors"
          >
            {isSignup ? "Already have an account? Login" : "New here? Register a professional account"}
          </button>
        </div>
      </form>
    </div>
  );
}
