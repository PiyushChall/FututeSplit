'use client';
import React from 'react';
import AuthForm from '../components/AuthForm';

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
      <h1 className="text-3xl font-bold mb-4 text-center text-gray-800 dark:text-gray-100">FutureSplit</h1>
      <p className="mb-8 text-gray-600 dark:text-gray-300 text-center max-w-md">
        Chat with two versions of your future self: one who succeeded, and one who failed. Start by logging in or signing up below.
      </p>
      <AuthForm />
    </div>
  );
}
