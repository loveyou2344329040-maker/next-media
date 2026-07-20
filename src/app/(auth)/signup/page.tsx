// src/app/(auth)/signup/page.tsx

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { signUpWithEmail } from "@/lib/firebase/services/authService";
import { createUserProfile, getUserByUsername } from "@/lib/firebase/services/userService";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/config";

// ─── Types ───────────────────────────────────────────
interface FormData {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  username: string;
  location: string;
  dateOfBirth: string;
}

interface LocationSuggestion {
  place_id: number;
  display_name: string;
}

// ─── Password Validation ──────────────────────────────
function validatePassword(password: string) {
  return {
    minLength: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
  };
}

function isPasswordValid(password: string) {
  const v = validatePassword(password);
  return v.minLength && v.uppercase && v.lowercase && v.number;
}

function isUsernameFormatValid(username: string) {
  return /^[a-z0-9_.]{4,20}$/.test(username);
}

// ─── Main Component ───────────────────────────────────
export default function SignUpPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [animating, setAnimating] = useState(false);
  const [direction, setDirection] = useState<"forward" | "back">("forward");

  const [form, setForm] = useState<FormData>({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
    username: "",
    location: "",
    dateOfBirth: "",
  });

  // Username check
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");
  const usernameTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Location autocomplete
  const [locationQuery, setLocationQuery] = useState("");
  const [locationSuggestions, setLocationSuggestions] = useState<LocationSuggestion[]>([]);
  const [locationLoading, setLocationLoading] = useState(false);
  const locationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Password visibility
  const [showPass, setShowPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  // Submit state
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // ── Navigate Steps ──────────────────────────────────
  const goToStep = (next: number, dir: "forward" | "back" = "forward") => {
    if (animating) return;
    setDirection(dir);
    setAnimating(true);
    setTimeout(() => {
      setStep(next);
      setAnimating(false);
    }, 280);
  };

  const handleNext = () => goToStep(step + 1, "forward");
  const handleBack = () => goToStep(step - 1, "back");

  // ── Username Live Check ──────────────────────────────
  const checkUsername = useCallback(async (val: string) => {
    if (!isUsernameFormatValid(val)) {
      setUsernameStatus("invalid");
      return;
    }
    setUsernameStatus("checking");
    try {
      const existing = await getUserByUsername(val);
      setUsernameStatus(existing ? "taken" : "available");
    } catch {
      setUsernameStatus("idle");
    }
  }, []);

  useEffect(() => {
    const val = form.username.trim();
    if (!val) { setUsernameStatus("idle"); return; }
    if (usernameTimer.current) clearTimeout(usernameTimer.current);
    usernameTimer.current = setTimeout(() => checkUsername(val), 600);
    return () => { if (usernameTimer.current) clearTimeout(usernameTimer.current); };
  }, [form.username, checkUsername]);

  // ── Location Autocomplete ────────────────────────────
  const fetchLocations = useCallback(async (q: string) => {
    if (q.length < 2) { setLocationSuggestions([]); return; }
    setLocationLoading(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5`,
        { headers: { "Accept-Language": "en", "User-Agent": "SkyLink-App/1.0" } }
      );
      const data: LocationSuggestion[] = await res.json();
      setLocationSuggestions(data);
      setShowSuggestions(true);
    } catch {
      setLocationSuggestions([]);
    } finally {
      setLocationLoading(false);
    }
  }, []);

  useEffect(() => {
    if (locationTimer.current) clearTimeout(locationTimer.current);
    locationTimer.current = setTimeout(() => fetchLocations(locationQuery), 500);
    return () => { if (locationTimer.current) clearTimeout(locationTimer.current); };
  }, [locationQuery, fetchLocations]);

  // ── Step Validation ──────────────────────────────────
  const canProceed = (): boolean => {
    switch (step) {
      case 1: return form.fullName.trim().length >= 2;
      case 2: return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email);
      case 3: return isPasswordValid(form.password) && form.password === form.confirmPassword;
      case 4: return usernameStatus === "available";
      case 5: return form.location.trim().length > 0 && form.dateOfBirth.trim().length > 0;
      default: return true;
    }
  };

  // ── Final Submit ─────────────────────────────────────
  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      // 1. Create Firebase Auth user
      const user = await signUpWithEmail(form.email, form.password, form.fullName);

      // 2. Save user profile to Firestore
      await createUserProfile(user.uid, {
        uid: user.uid,
        email: form.email,
        username: form.username.toLowerCase(),
        displayName: form.fullName,
        photoURL: null,
        coverPhotoURL: null,
        bio: "",
        website: "",
        location: form.location,
        isVerified: false,
        isPrivate: false,
        fcmToken: null,
      });

      // 3. Save unique username mapping
      await setDoc(doc(db, "usernames", form.username.toLowerCase()), {
        uid: user.uid,
        createdAt: serverTimestamp(),
      });

      // 4. Redirect to home (server-side rendered)
      router.push("/");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      if (msg.includes("email-already-in-use")) {
        setSubmitError("এই email দিয়ে আগেই account আছে।");
      } else {
        setSubmitError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ── Password validation state ────────────────────────
  const passValid = validatePassword(form.password);

  // ── Render ───────────────────────────────────────────
  return (
    <>
      <style>{`
        :root {
          --bg: #ffffff;
          --text-primary: #111827;
          --text-secondary: #6B7280;
          --input-bg: #F3F4F6;
          --btn: #38BDF8;
          --btn-text: #ffffff;
          --border-subtle: #E5E7EB;
          --success: #22C55E;
          --danger: #EF4444;
          --shadow: 0 2px 12px rgba(0,0,0,0.07);
        }
        @media (prefers-color-scheme: dark) {
          :root {
            --bg: #0F172A;
            --text-primary: #F1F5F9;
            --text-secondary: #94A3B8;
            --input-bg: #1E293B;
            --btn: #38BDF8;
            --btn-text: #ffffff;
            --border-subtle: #334155;
            --success: #4ADE80;
            --danger: #F87171;
            --shadow: 0 2px 16px rgba(0,0,0,0.35);
          }
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: var(--bg); color: var(--text-primary); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }

        .signup-root {
          min-height: 100dvh;
          background: var(--bg);
          display: flex;
          flex-direction: column;
          padding: env(safe-area-inset-top, 0px) env(safe-area-inset-right, 0) env(safe-area-inset-bottom, 0) env(safe-area-inset-left, 0);
          overflow: hidden;
        }

        /* Top bar */
        .signup-topbar {
          display: flex;
          justify-content: flex-end;
          align-items: center;
          padding: 16px 24px 8px;
        }
        .step-label {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-secondary);
          letter-spacing: 0.02em;
        }

        /* Progress bar */
        .progress-track {
          height: 3px;
          background: var(--input-bg);
          margin: 0 24px;
          border-radius: 99px;
          overflow: hidden;
        }
        .progress-fill {
          height: 100%;
          background: var(--btn);
          border-radius: 99px;
          transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }

        /* Scroll container */
        .signup-scroll {
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
        }
        .signup-scroll::-webkit-scrollbar { display: none; }

        /* Step panel */
        .step-panel {
          min-height: calc(100dvh - 90px);
          padding: 32px 24px 40px;
          display: flex;
          flex-direction: column;
          will-change: transform, opacity;
          transition: transform 0.28s cubic-bezier(0.4,0,0.2,1), opacity 0.28s ease;
        }
        .step-panel.enter-forward  { transform: translateX(0); opacity: 1; }
        .step-panel.exit-forward   { transform: translateX(-40px); opacity: 0; }
        .step-panel.enter-back     { transform: translateX(0); opacity: 1; }
        .step-panel.exit-back      { transform: translateX(40px); opacity: 0; }
        .step-panel.animating      { transform: translateX(${direction === 'forward' ? '40px' : '-40px'}); opacity: 0; }

        /* Logo area */
        .logo-area {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 32px;
        }
        .logo-icon {
          width: 40px;
          height: 40px;
          border-radius: 12px;
          background: linear-gradient(135deg, #38BDF8 0%, #0EA5E9 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 12px rgba(56,189,248,0.35);
        }
        .logo-text {
          font-size: 22px;
          font-weight: 800;
          color: var(--text-primary);
          letter-spacing: -0.5px;
        }
        .logo-text span { color: #38BDF8; }

        /* Headings */
        .step-heading {
          font-size: 26px;
          font-weight: 800;
          color: var(--text-primary);
          line-height: 1.25;
          letter-spacing: -0.5px;
          margin-bottom: 8px;
        }
        .step-sub {
          font-size: 15px;
          color: var(--text-secondary);
          margin-bottom: 32px;
          line-height: 1.5;
        }

        /* Inputs */
        .input-wrap { margin-bottom: 14px; }
        .inp {
          width: 100%;
          padding: 16px 18px;
          background: var(--input-bg);
          border: none;
          outline: none;
          border-radius: 14px;
          font-size: 16px;
          color: var(--text-primary);
          box-shadow: var(--shadow);
          transition: background 0.2s, box-shadow 0.2s;
          -webkit-appearance: none;
          appearance: none;
        }
        .inp::placeholder { color: var(--text-secondary); }
        .inp:focus { box-shadow: 0 0 0 2.5px rgba(56,189,248,0.35), var(--shadow); }
        .inp-row {
          position: relative;
        }
        .inp-row .inp { padding-right: 52px; }
        .eye-btn {
          position: absolute;
          right: 16px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          color: var(--text-secondary);
          cursor: pointer;
          padding: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        /* Password rules */
        .pass-rules {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin-top: 12px;
          margin-bottom: 4px;
        }
        .rule {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          color: var(--text-secondary);
          transition: color 0.2s;
        }
        .rule.ok { color: var(--success); }
        .rule-dot {
          width: 7px; height: 7px;
          border-radius: 50%;
          background: var(--text-secondary);
          flex-shrink: 0;
          transition: background 0.2s;
        }
        .rule.ok .rule-dot { background: var(--success); }

        /* Username status */
        .username-status {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          margin-top: 8px;
          padding-left: 4px;
          min-height: 20px;
          transition: opacity 0.2s;
        }
        .username-status.available { color: var(--success); }
        .username-status.taken { color: var(--danger); }
        .username-status.invalid { color: var(--danger); }
        .username-status.checking { color: var(--text-secondary); }

        /* Location suggestions */
        .location-list {
          background: var(--input-bg);
          border-radius: 14px;
          margin-top: 6px;
          overflow: hidden;
          box-shadow: var(--shadow);
        }
        .location-item {
          padding: 14px 18px;
          font-size: 14px;
          color: var(--text-primary);
          cursor: pointer;
          border-bottom: 1px solid var(--border-subtle);
          transition: background 0.15s;
          line-height: 1.4;
        }
        .location-item:last-child { border-bottom: none; }
        .location-item:active, .location-item:hover { background: rgba(56,189,248,0.08); }

        /* Date input */
        input[type="date"].inp {
          color: var(--text-primary);
        }
        input[type="date"].inp::-webkit-calendar-picker-indicator {
          opacity: 0.5;
          filter: invert(0.5);
          cursor: pointer;
        }

        /* Summary card */
        .summary-rows { margin-bottom: 32px; }
        .summary-row {
          display: flex;
          flex-direction: column;
          padding: 14px 0;
          border-bottom: 1px solid var(--border-subtle);
        }
        .summary-row:first-child { border-top: 1px solid var(--border-subtle); }
        .summary-label {
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--text-secondary);
          margin-bottom: 3px;
        }
        .summary-value {
          font-size: 16px;
          color: var(--text-primary);
          font-weight: 500;
        }

        /* Error */
        .error-msg {
          color: var(--danger);
          font-size: 13px;
          margin-bottom: 12px;
          padding: 10px 14px;
          background: rgba(239,68,68,0.08);
          border-radius: 10px;
        }

        /* Buttons */
        .btn-primary {
          width: 100%;
          padding: 17px;
          background: var(--btn);
          color: var(--btn-text);
          font-size: 16px;
          font-weight: 700;
          border: none;
          border-radius: 99px;
          cursor: pointer;
          box-shadow: 0 4px 16px rgba(56,189,248,0.4);
          transition: opacity 0.2s, transform 0.15s;
          -webkit-tap-highlight-color: transparent;
          letter-spacing: 0.01em;
        }
        .btn-primary:disabled {
          opacity: 0.38;
          cursor: not-allowed;
          box-shadow: none;
          transform: none;
        }
        .btn-primary:not(:disabled):active { transform: scale(0.98); }

        .btn-back {
          background: none;
          border: none;
          color: var(--text-secondary);
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          padding: 12px 0;
          margin-bottom: 12px;
          display: flex;
          align-items: center;
          gap: 6px;
          -webkit-tap-highlight-color: transparent;
        }

        /* Spacer */
        .spacer { flex: 1; }

        /* Spinner */
        @keyframes spin { to { transform: rotate(360deg); } }
        .spinner {
          width: 20px; height: 20px;
          border: 2px solid rgba(255,255,255,0.4);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
          display: inline-block;
          vertical-align: middle;
          margin-right: 8px;
        }

        @keyframes checkDot {
          from { transform: scale(0.5); opacity:0; }
          to   { transform: scale(1);   opacity:1; }
        }
      `}</style>

      <div className="signup-root">
        {/* Top bar */}
        <div className="signup-topbar">
          <span className="step-label">Step {step} of 6</span>
        </div>

        {/* Progress bar */}
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${(step / 6) * 100}%` }} />
        </div>

        {/* Scrollable area */}
        <div className="signup-scroll">
          <div className={`step-panel ${animating ? "animating" : ""}`}>

            {/* ── STEP 1: Full Name ── */}
            {step === 1 && (
              <>
                <div className="logo-area">
                  <div className="logo-icon">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                      <path d="M12 2L2 7l10 5 10-5-10-5z" fill="white" opacity="0.9"/>
                      <path d="M2 17l10 5 10-5" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                      <path d="M2 12l10 5 10-5" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  </div>
                  <div className="logo-text">Sky<span>Link</span></div>
                </div>

                <div className="step-heading">Create your account</div>
                <div className="step-sub">Let&apos;s get started with your basic info.</div>

                <div className="input-wrap">
                  <input
                    className="inp"
                    type="text"
                    placeholder="Full Name"
                    autoComplete="name"
                    value={form.fullName}
                    onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))}
                    autoFocus
                  />
                </div>

                <div className="spacer" />
                <button
                  className="btn-primary"
                  disabled={!canProceed()}
                  onClick={handleNext}
                >
                  Next
                </button>
              </>
            )}

            {/* ── STEP 2: Email ── */}
            {step === 2 && (
              <>
                <button className="btn-back" onClick={handleBack}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 12H5M12 19l-7-7 7-7"/>
                  </svg>
                  Back
                </button>

                <div className="step-heading">What&apos;s your email?</div>
                <div className="step-sub">You&apos;ll use this to log in.</div>

                <div className="input-wrap">
                  <input
                    className="inp"
                    type="email"
                    placeholder="Email Address"
                    autoComplete="email"
                    inputMode="email"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    autoFocus
                  />
                </div>

                <div className="spacer" />
                <button
                  className="btn-primary"
                  disabled={!canProceed()}
                  onClick={handleNext}
                >
                  Next
                </button>
              </>
            )}

            {/* ── STEP 3: Password ── */}
            {step === 3 && (
              <>
                <button className="btn-back" onClick={handleBack}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 12H5M12 19l-7-7 7-7"/>
                  </svg>
                  Back
                </button>

                <div className="step-heading">Create a password</div>
                <div className="step-sub">Make sure it&apos;s strong and secure.</div>

                <div className="input-wrap">
                  <div className="inp-row">
                    <input
                      className="inp"
                      type={showPass ? "text" : "password"}
                      placeholder="Password"
                      autoComplete="new-password"
                      value={form.password}
                      onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                      autoFocus
                    />
                    <button className="eye-btn" type="button" onClick={() => setShowPass(v => !v)} aria-label="Toggle password visibility">
                      {showPass
                        ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                        : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      }
                    </button>
                  </div>
                </div>

                <div className="input-wrap">
                  <div className="inp-row">
                    <input
                      className="inp"
                      type={showConfirmPass ? "text" : "password"}
                      placeholder="Confirm Password"
                      autoComplete="new-password"
                      value={form.confirmPassword}
                      onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))}
                    />
                    <button className="eye-btn" type="button" onClick={() => setShowConfirmPass(v => !v)} aria-label="Toggle confirm password visibility">
                      {showConfirmPass
                        ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                        : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      }
                    </button>
                  </div>
                </div>

                {/* Password rules */}
                <div className="pass-rules">
                  <div className={`rule ${passValid.minLength ? "ok" : ""}`}>
                    <div className="rule-dot" />
                    8+ Characters
                  </div>
                  <div className={`rule ${passValid.uppercase ? "ok" : ""}`}>
                    <div className="rule-dot" />
                    1 Uppercase
                  </div>
                  <div className={`rule ${passValid.lowercase ? "ok" : ""}`}>
                    <div className="rule-dot" />
                    1 Lowercase
                  </div>
                  <div className={`rule ${passValid.number ? "ok" : ""}`}>
                    <div className="rule-dot" />
                    1 Number
                  </div>
                </div>

                {form.confirmPassword && form.password !== form.confirmPassword && (
                  <p style={{ color: "var(--danger)", fontSize: 13, marginTop: 8, paddingLeft: 4 }}>
                    Passwords do not match.
                  </p>
                )}

                <div className="spacer" />
                <button
                  className="btn-primary"
                  disabled={!canProceed()}
                  onClick={handleNext}
                >
                  Next
                </button>
              </>
            )}

            {/* ── STEP 4: Username ── */}
            {step === 4 && (
              <>
                <button className="btn-back" onClick={handleBack}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 12H5M12 19l-7-7 7-7"/>
                  </svg>
                  Back
                </button>

                <div className="step-heading">Choose your username</div>
                <div className="step-sub">This will be your unique identity.</div>

                <div className="input-wrap">
                  <input
                    className="inp"
                    type="text"
                    placeholder="Username"
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    value={form.username}
                    onChange={e => setForm(f => ({ ...f, username: e.target.value.toLowerCase() }))}
                    autoFocus
                  />
                  <div className={`username-status ${usernameStatus}`}>
                    {usernameStatus === "checking" && (
                      <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: "spin 0.7s linear infinite" }}><path d="M21 12a9 9 0 1 1-6.22-8.56"/></svg> Checking…</>
                    )}
                    {usernameStatus === "available" && (
                      <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg> Username Available</>
                    )}
                    {usernameStatus === "taken" && (
                      <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Username Already Taken</>
                    )}
                    {usernameStatus === "invalid" && form.username && (
                      <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Only a–z, 0–9, _ or . (4–20 chars)</>
                    )}
                  </div>
                </div>

                <div className="spacer" />
                <button
                  className="btn-primary"
                  disabled={!canProceed()}
                  onClick={handleNext}
                >
                  Next
                </button>
              </>
            )}

            {/* ── STEP 5: Location + DOB ── */}
            {step === 5 && (
              <>
                <button className="btn-back" onClick={handleBack}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 12H5M12 19l-7-7 7-7"/>
                  </svg>
                  Back
                </button>

                <div className="step-heading">Where are you from?</div>
                <div className="step-sub">Help people find you.</div>

                {/* Location search */}
                <div className="input-wrap">
                  <input
                    className="inp"
                    type="text"
                    placeholder="Search location…"
                    autoComplete="off"
                    value={locationQuery}
                    onChange={e => {
                      setLocationQuery(e.target.value);
                      if (!e.target.value) {
                        setForm(f => ({ ...f, location: "" }));
                        setShowSuggestions(false);
                      }
                    }}
                    autoFocus
                  />
                  {locationLoading && (
                    <p style={{ color: "var(--text-secondary)", fontSize: 13, marginTop: 6, paddingLeft: 4 }}>Searching…</p>
                  )}
                  {showSuggestions && locationSuggestions.length > 0 && (
                    <div className="location-list">
                      {locationSuggestions.map(s => (
                        <div
                          key={s.place_id}
                          className="location-item"
                          onClick={() => {
                            setForm(f => ({ ...f, location: s.display_name }));
                            setLocationQuery(s.display_name);
                            setShowSuggestions(false);
                          }}
                        >
                          {s.display_name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Date of Birth */}
                <div className="input-wrap" style={{ marginTop: 8 }}>
                  <label style={{ fontSize: 13, color: "var(--text-secondary)", paddingLeft: 4, display: "block", marginBottom: 6 }}>Date of Birth</label>
                  <input
                    className="inp"
                    type="date"
                    value={form.dateOfBirth}
                    max={new Date(Date.now() - 13 * 365.25 * 24 * 3600 * 1000).toISOString().split("T")[0]}
                    onChange={e => setForm(f => ({ ...f, dateOfBirth: e.target.value }))}
                  />
                </div>

                <div className="spacer" />
                <button
                  className="btn-primary"
                  disabled={!canProceed()}
                  onClick={handleNext}
                >
                  Next
                </button>
              </>
            )}

            {/* ── STEP 6: Summary ── */}
            {step === 6 && (
              <>
                <button className="btn-back" onClick={handleBack}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 12H5M12 19l-7-7 7-7"/>
                  </svg>
                  Back
                </button>

                <div className="step-heading">Almost done!</div>
                <div className="step-sub">Review your info before creating your account.</div>

                <div className="summary-rows">
                  {[
                    { label: "Full Name", value: form.fullName },
                    { label: "Email", value: form.email },
                    { label: "Username", value: `@${form.username}` },
                    { label: "Location", value: form.location },
                    { label: "Date of Birth", value: form.dateOfBirth },
                  ].map(row => (
                    <div className="summary-row" key={row.label}>
                      <span className="summary-label">{row.label}</span>
                      <span className="summary-value">{row.value}</span>
                    </div>
                  ))}
                </div>

                {submitError && (
                  <div className="error-msg">{submitError}</div>
                )}

                <button
                  className="btn-primary"
                  disabled={submitting}
                  onClick={handleSubmit}
                >
                  {submitting ? (
                    <><span className="spinner" />Creating Account…</>
                  ) : "Create Account"}
                </button>
              </>
            )}

          </div>
        </div>
      </div>
    </>
  );
}
