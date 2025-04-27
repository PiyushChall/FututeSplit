"use client";
import React from 'react';
import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function AuthForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [signupSuccess, setSignupSuccess] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    let result;
    if (mode === "login") {
      result = await supabase.auth.signInWithPassword({ email, password });
    } else {
      result = await supabase.auth.signUp({ email, password });
    }
    setLoading(false);
    if (result.error) {
      setError(result.error.message);
    } else {
      if (mode === "signup") {
        setSignupSuccess(true);
        return;
      }
      router.push("/chat");
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white dark:bg-gray-800 p-6 rounded shadow-md w-full max-w-sm animate-fade-in-up"
      style={{ animationDelay: '0.1s', animationFillMode: 'both' }}
    >
      <div className="mb-4">
        <label className="block mb-1 text-gray-700 dark:text-gray-200">Email</label>
        <input
          type="email"
          className="w-full px-3 py-2 border rounded focus:outline-none focus:ring"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
        />
      </div>
      <div className="mb-4">
        <label className="block mb-1 text-gray-700 dark:text-gray-200">Password</label>
        <input
          type="password"
          className="w-full px-3 py-2 border rounded focus:outline-none focus:ring"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
        />
      </div>
      {error && (
        <div className="mb-2 text-red-500 text-sm transition-all duration-300 animate-fade-in-slide">
          {error}
        </div>
      )}
      {signupSuccess && (
        <div className="mb-2 text-green-600 text-sm transition-all duration-300 animate-fade-in-slide">
          Signup successful! Please check your email and click the confirmation link to activate your account before logging in.
        </div>
      )}
      <button
        type="submit"
        className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition"
        disabled={loading}
      >
        {loading ? "Loading..." : mode === "login" ? "Login" : "Sign Up"}
      </button>
      <div className="mt-4 text-center">
        {mode === "login" ? (
          <span className="text-gray-600 dark:text-gray-300 text-sm">
            New here?{' '}
            <button type="button" className="underline" onClick={() => setMode("signup")}>Sign Up</button>
          </span>
        ) : (
          <span className="text-gray-600 dark:text-gray-300 text-sm">
            Already have an account?{' '}
            <button type="button" className="underline" onClick={() => setMode("login")}>Login</button>
          </span>
        )}
      </div>
    </form>
  );
} 