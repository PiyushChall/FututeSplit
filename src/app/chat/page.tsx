"use client";
import React, { useState, useRef, useEffect } from "react";

interface Message {
  sender: "user" | "success" | "failure";
  text: string;
}

function getDiceBearAvatar(personality: string, type: "success" | "failure", gender: string) {
  // Use gendered style if possible
  let style = "adventurer";
  if (gender === "female") style = "adventurer-female";
  if (gender === "male") style = "adventurer";
  if (gender === "other") style = "micah";
  const seed = encodeURIComponent(`${personality}-${type}-${gender}`);
  return `https://api.dicebear.com/7.x/${style}/svg?seed=${seed}`;
}

function getEmojiAvatar(type: "success" | "failure", gender: string) {
  if (type === "success") {
    if (gender === "female") return "😊";
    if (gender === "male") return "😃";
    return "😎";
  } else {
    if (gender === "female") return "😢";
    if (gender === "male") return "😞";
    return "😐";
  }
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [goal, setGoal] = useState("");
  const [personality, setPersonality] = useState("");
  const [gender, setGender] = useState("");
  const [onboarding, setOnboarding] = useState(true);
  const [loading, setLoading] = useState(false);
  const [useEmoji, setUseEmoji] = useState(false); // fallback if avatar fails
  const chatEndRef = useRef<HTMLDivElement>(null);
  const lastSpokenRef = useRef<number>(-1); // index of last spoken message
  const [voicesReady, setVoicesReady] = useState(false);
  const speechQueue = useRef<{text: string, gender: string, onEnd?: () => void}[]>([]);
  const [playingIdx, setPlayingIdx] = useState<number | null>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, onboarding]);

  // Onboarding: ask for goal, personality, and gender
  const handleOnboarding = (e: React.FormEvent) => {
    e.preventDefault();
    if (!goal.trim() || !personality.trim() || !gender) return;
    setOnboarding(false);
    setMessages([
      {
        sender: "success",
        text: `Hi! I'm your future self who succeeded in my goal: "${goal}". I'm here to help you achieve it!`,
      },
      {
        sender: "failure",
        text: `Hi... I'm your future self who failed to achieve the goal: "${goal}". I'll share my regrets and what went wrong, so you can avoid my mistakes.`,
      },
      {
        sender: "user",
        text: "[You can start chatting now!]",
      },
    ]);
  };

  // Chat send
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;
    // Stop any current speech
    if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
    const userMessage = { sender: "user" as const, text: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);
    // Show loading placeholders for both personas
    setMessages((prev) => [
      ...prev,
      { sender: "success", text: "..." },
      { sender: "failure", text: "..." },
    ]);
    try {
      const response = await fetch("/api/echo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          history: [...messages, userMessage],
          goal,
          personality,
          gender,
        }),
      });
      const data = await response.json();
      setMessages((prev) => [
        ...prev.slice(0, -2), // Remove loading placeholders
        { sender: "success", text: data.successText || "[No response from Success You]" },
        { sender: "failure", text: data.failureText || "[No response from Failure You]" },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev.slice(0, -2),
        { sender: "success", text: "[Error: Failed to get response from Success You]" },
        { sender: "failure", text: "[Error: Failed to get response from Failure You]" },
      ]);
    }
    setLoading(false);
  };

  // Avatar URLs
  const successAvatar = useEmoji
    ? getEmojiAvatar("success", gender)
    : getDiceBearAvatar(personality, "success", gender);
  const failureAvatar = useEmoji
    ? getEmojiAvatar("failure", gender)
    : getDiceBearAvatar(personality, "failure", gender);

  // Try loading avatars, fallback to emoji if error
  useEffect(() => {
    if (!onboarding && !useEmoji) {
      const img1 = new window.Image();
      const img2 = new window.Image();
      let errored = false;
      img1.onerror = img2.onerror = () => {
        if (!errored) setUseEmoji(true);
        errored = true;
      };
      img1.src = successAvatar;
      img2.src = failureAvatar;
    }
    // eslint-disable-next-line
  }, [onboarding, personality, gender]);

  // Ensure voices are loaded before speaking
  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    function handleVoicesChanged() {
      setVoicesReady(true);
      // Play any queued speech
      if (speechQueue.current.length > 0) {
        const { text, gender, onEnd } = speechQueue.current.shift()!;
        speak(text, gender, onEnd);
      }
    }
    window.speechSynthesis.onvoiceschanged = handleVoicesChanged;
    // Try to trigger voices load
    if (window.speechSynthesis.getVoices().length > 0) {
      setVoicesReady(true);
    }
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  function speak(text: string, gender: string, onEnd?: () => void, idx?: number) {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    // If voices not ready, queue the speech
    const voices = window.speechSynthesis.getVoices();
    if (!voicesReady || voices.length === 0) {
      speechQueue.current.push({ text, gender, onEnd });
      return;
    }
    window.speechSynthesis.cancel();
    const utter = new window.SpeechSynthesisUtterance(text);
    let selectedVoice = voices.find(v =>
      gender === "female" ? v.name.toLowerCase().includes("female") :
      gender === "male" ? v.name.toLowerCase().includes("male") :
      false
    );
    if (!selectedVoice) {
      selectedVoice = voices.find(v =>
        gender === "female" ? v.name.toLowerCase().includes("woman") :
        gender === "male" ? v.name.toLowerCase().includes("man") : false
      );
    }
    if (!selectedVoice && voices.length > 0) selectedVoice = voices[0];
    if (selectedVoice) utter.voice = selectedVoice;
    utter.rate = 1;
    utter.pitch = 1;
    utter.onend = () => {
      setPlayingIdx(null);
      if (onEnd) onEnd();
    };
    setPlayingIdx(idx ?? null);
    window.speechSynthesis.speak(utter);
  }

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-950 dark:to-blue-950 font-sans rounded-xl">
      <header className="py-6 bg-blue-600 shadow-lg text-white text-center font-bold text-2xl tracking-wide drop-shadow-lg bg-gradient-to-r from-blue-500 to-blue-700">
        FutureSplit Chat
      </header>
      <main className="flex-1 flex flex-col items-center justify-center py-4 px-2 w-full">
        {onboarding ? (
          <form
            onSubmit={handleOnboarding}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 max-w-md w-full flex flex-col gap-5 animate-fade-in-up"
          >
            <h2 className="text-xl font-bold mb-2 text-gray-800 dark:text-gray-100">Let's get to know you!</h2>
            <label className="font-medium text-gray-700 dark:text-gray-200">What is your main future goal?</label>
            <input
              type="text"
              value={goal}
              onChange={e => setGoal(e.target.value)}
              placeholder="e.g. Become a doctor, start a business..."
              className="p-3 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 text-base mb-2 focus:outline-none focus:ring focus:ring-blue-200 dark:focus:ring-blue-800 transition"
              required
            />
            <label className="font-medium text-gray-700 dark:text-gray-200">How would you describe yourself as a person?</label>
            <input
              type="text"
              value={personality}
              onChange={e => setPersonality(e.target.value)}
              placeholder="e.g. Ambitious, creative, introverted..."
              className="p-3 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 text-base mb-2 focus:outline-none focus:ring focus:ring-blue-200 dark:focus:ring-blue-800 transition"
              required
            />
            <label className="font-medium text-gray-700 dark:text-gray-200">What is your gender?</label>
            <select
              value={gender}
              onChange={e => setGender(e.target.value)}
              className="p-3 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 text-base mb-2 focus:outline-none focus:ring focus:ring-blue-200 dark:focus:ring-blue-800 transition"
              required
            >
              <option value="">Select...</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg py-3 px-6 mt-2 transition"
            >
              Start Chatting
            </button>
          </form>
        ) : (
          <>
            {/* Persona cards at the top */}
            <div className="flex flex-wrap justify-center gap-8 mb-8 w-full max-w-2xl">
              <div className="bg-green-50 dark:bg-green-900 border-2 border-green-600 rounded-2xl p-6 min-w-[180px] flex flex-col items-center shadow-md">
                <div className="mb-2 w-16 h-16 rounded-full bg-white flex items-center justify-center border-4 border-green-300 dark:border-green-700 overflow-hidden">
                  {useEmoji ? successAvatar : <img src={successAvatar} alt="Success Avatar" className="w-14 h-14 rounded-full" />}
                </div>
                <div className="font-bold text-green-700 dark:text-green-300">Success You</div>
                <div className="text-xs text-green-800 dark:text-green-200 mt-1">Achieved your goal</div>
              </div>
              <div className="bg-red-50 dark:bg-red-900 border-2 border-red-600 rounded-2xl p-6 min-w-[180px] flex flex-col items-center shadow-md">
                <div className="mb-2 w-16 h-16 rounded-full bg-white flex items-center justify-center border-4 border-red-300 dark:border-red-700 overflow-hidden">
                  {useEmoji ? failureAvatar : <img src={failureAvatar} alt="Failure Avatar" className="w-14 h-14 rounded-full" />}
                </div>
                <div className="font-bold text-red-700 dark:text-red-300">Failure You</div>
                <div className="text-xs text-red-800 dark:text-red-200 mt-1">Did not achieve your goal</div>
              </div>
            </div>
            {/* Chat messages */}
            <div className="flex flex-col gap-4 w-full max-w-2xl mb-4">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={
                    (msg.sender === "user"
                      ? "flex justify-end"
                      : msg.sender === "success"
                      ? "flex justify-end"
                      : "flex justify-start") +
                    " animate-fade-in-up"
                  }
                >
                  {msg.sender !== "user" && (
                    <span className="flex items-end mr-2">
                      {msg.sender === "success"
                        ? useEmoji
                          ? successAvatar
                          : <img src={successAvatar} alt="Success Avatar" className="w-8 h-8 rounded-full border-2 border-green-400 dark:border-green-700" />
                        : useEmoji
                        ? failureAvatar
                        : <img src={failureAvatar} alt="Failure Avatar" className="w-8 h-8 rounded-full border-2 border-red-400 dark:border-red-700" />}
                    </span>
                  )}
                  <div
                    className={
                      msg.sender === "user"
                        ? "bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-2xl shadow-md px-6 py-3 max-w-[75%] text-base font-medium"
                        : msg.sender === "success"
                        ? "bg-green-600 dark:bg-green-700 text-white rounded-2xl shadow-md px-6 py-3 max-w-[75%] text-base font-medium border-2 border-green-700 dark:border-green-700"
                        : "bg-red-600 dark:bg-red-700 text-white rounded-2xl shadow-md px-6 py-3 max-w-[75%] text-base font-medium border-2 border-red-700 dark:border-red-700"
                    }
                    style={{ position: "relative", opacity: msg.text === "..." ? 0.6 : 1 }}
                  >
                    <span className="font-semibold text-sm mr-2">
                      {msg.sender === "user"
                        ? "You"
                        : msg.sender === "success"
                        ? "Success You"
                        : "Failure You"}
                    </span>
                    <br />
                    {msg.text}
                    {/* Voice button for persona messages */}
                    {msg.sender !== "user" && (
                      <button
                        onClick={() => {
                          if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
                          speak(msg.text, gender, undefined, idx);
                        }}
                        className={
                          msg.sender === "success"
                            ? "absolute right-3 bottom-2 text-green-200 hover:text-green-100 text-lg"
                            : "absolute right-3 bottom-2 text-red-200 hover:text-red-100 text-lg"
                        }
                        title="Play voice"
                        aria-label="Play voice"
                      >
                        🔊
                      </button>
                    )}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
          </>
        )}
      </main>
      {/* Chat input area */}
      {!onboarding && (
        <form
          onSubmit={handleSend}
          className="flex p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 max-w-2xl mx-auto w-full rounded-3xl shadow-lg mb-6"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 p-3 rounded-2xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-700 text-base mr-3 transition"
            disabled={loading}
          />
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-2xl py-3 px-6 transition disabled:bg-blue-300"
            disabled={loading}
          >
            {loading ? "Sending..." : "Send"}
          </button>
        </form>
      )}
    </div>
  );
} 