"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, serverTimestamp, collection, query, where, getDocs } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/config";

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

export default function SignUpPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [animating, setAnimating] = useState(false);

  const [form, setForm] = useState<FormData>({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
    username: "",
    location: "",
    dateOfBirth: "",
  });

  const [usernameStatus, setUsernameStatus] = useState
    "idle" | "checking" | "available" | "taken" | "invalid"
  >("idle");
  const usernameTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [locationQuery, setLocationQuery] = useState("");
  const [locationSuggestions, setLocationSuggestions] = useState<LocationSuggestion[]>([]);
  const [locationLoading, setLocationLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const locationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [showPass, setShowPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const goToStep = (next: number, _dir: "forward" | "back") => {
    if (animating) return;
    setAnimating(true);
    setTimeout(() => {
      setStep(next);
      setAnimating(false);
    }, 260);
  };

  const checkUsername = useCallback(async (val: string) => {
    if (!isUsernameFormatValid(val)) {
      setUsernameStatus("invalid");
      return;
    }
    setUsernameStatus("checking");
    try {
      const q = query(
        collection(db, "usernames"),
        where("username", "==", val.toLowerCase())
      );
      const snap = await getDocs(q);
      setUsernameStatus(snap.empty ? "available" : "taken");
    } catch (err) {
      console.error("Username check error:", err);
      setUsernameStatus("available");
    }
  }, []);

  useEffect(() => {
    const val = form.username.trim();
    if (!val) {
      setUsernameStatus("idle");
      return;
    }
    if (usernameTimer.current) clearTimeout(usernameTimer.current);
    usernameTimer.current = setTimeout(() => checkUsername(val), 600);
    return () => {
      if (usernameTimer.current) clearTimeout(usernameTimer.current);
    };
  }, [form.username, checkUsername]);

  const fetchLocations = useCallback(async (q: string) => {
    if (q.length < 2) {
      setLocationSuggestions([]);
      return;
    }
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
    return () => {
      if (locationTimer.current) clearTimeout(locationTimer.current);
    };
  }, [locationQuery, fetchLocations]);

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

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      const credential = await createUserWithEmailAndPassword(
        auth,
        form.email,
        form.password
      );
      const uid = credential.user.uid;

      await setDoc(doc(db, "users", uid), {
        uid,
        email: form.email,
        username: form.username.toLowerCase(),
        fullName: form.fullName,
        profilePhotoUrl: "",
        bio: "",
        location: form.location,
        dateOfBirth: form.dateOfBirth,
        followers: 0,
        following: 0,
        postsCount: 0,
        isVerified: false,
        isPrivate: false,
        createdAt: serverTimestamp(),
      });

      await setDoc(doc(db, "usernames", form.username.toLowerCase()), {
        uid,
        username: form.username.toLowerCase(),
        createdAt: serverTimestamp(),
      });

      router.push("/");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      setSubmitError(
        msg.includes("email-already-in-use")
          ? "এই email দিয়ে আগেই account আছে।"
          : msg
      );
    } finally {
      setSubmitting(false);
    }
  };

  const passValid = validatePassword(form.password);

  function EyeOpen() {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  }

  function EyeOff() {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </svg>
    );
  }

  function BackArrow() {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 12H5M12 19l-7-7 7-7" />
      </svg>
    );
  }

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
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; background: var(--bg); }
        @keyframes spin { to { transform: rotate(360deg); } }
        .su-root {
          min-height: 100dvh;
          background: var(--bg);
          display: flex;
          flex-direction: column;
          padding-top: env(safe-area-inset-top, 0px);
          padding-bottom: env(safe-area-inset-bottom, 0px);
          overflow: hidden;
        }
        .su-topbar {
          display: flex;
          justify-content: flex-end;
          padding: 16px 24px 10px;
          flex-shrink: 0;
        }
        .su-step-label {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-secondary);
          letter-spacing: 0.03em;
        }
        .su-progress-track {
          height: 3px;
          background: var(--input-bg);
          margin: 0 24px;
          border-radius: 99px;
          overflow: hidden;
          flex-shrink: 0;
        }
        .su-progress-fill {
          height: 100%;
          background: var(--btn);
          border-radius: 99px;
          transition: width 0.4s cubic-bezier(0.4,0,0.2,1);
        }
        .su-scroll {
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
        }
        .su-scroll::-webkit-scrollbar { display: none; }
        .su-panel {
          min-height: calc(100dvh - 70px);
          padding: 28px 24px 40px;
          display: flex;
          flex-direction: column;
          transition: opacity 0.26s ease;
        }
        .su-panel.is-animating { opacity: 0; pointer-events: none; }
        .su-logo-block {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 14px;
          margin-bottom: 36px;
        }
        .su-logo-img {
          width: 64px;
          height: 64px;
          object-fit: contain;
          border-radius: 16px;
        }
        .su-logo-name {
          font-size: 28px;
          font-weight: 900;
          color: var(--text-primary);
          letter-spacing: -0.8px;
          line-height: 1;
        }
        .su-logo-name span { color: #38BDF8; }
        .su-heading {
          font-size: 26px;
          font-weight: 800;
          color: var(--text-primary);
          letter-spacing: -0.5px;
          line-height: 1.2;
          margin-bottom: 8px;
        }
        .su-sub {
          font-size: 15px;
          color: var(--text-secondary);
          line-height: 1.5;
          margin-bottom: 32px;
        }
        .su-input-wrap { margin-bottom: 14px; }
        .su-inp {
          width: 100%;
          padding: 16px 18px;
          background: var(--input-bg);
          border: none;
          outline: none;
          border-radius: 14px;
          font-size: 16px;
          color: var(--text-primary);
          box-shadow: var(--shadow);
          transition: box-shadow 0.2s;
          -webkit-appearance: none;
          appearance: none;
          font-family: inherit;
        }
        .su-inp::placeholder { color: var(--text-secondary); }
        .su-inp:focus { box-shadow: 0 0 0 2.5px rgba(56,189,248,0.35), var(--shadow); }
        .su-inp-row { position: relative; }
        .su-inp-row .su-inp { padding-right: 52px; }
        .su-eye {
          position: absolute;
          right: 14px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          color: var(--text-secondary);
          cursor: pointer;
          padding: 6px;
          display: flex;
          align-items: center;
          -webkit-tap-highlight-color: transparent;
        }
        .su-rules {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin-top: 10px;
        }
        .su-rule {
          display: flex;
          align-items: center;
          gap: 7px;
          font-size: 13px;
          color: var(--text-secondary);
          transition: color 0.2s;
        }
        .su-rule.ok { color: var(--success); }
        .su-rule-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: currentColor;
          flex-shrink: 0;
        }
        .su-username-status {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          margin-top: 8px;
          padding-left: 2px;
          min-height: 20px;
        }
        .su-username-status.available { color: var(--success); }
        .su-username-status.taken,
        .su-username-status.invalid { color: var(--danger); }
        .su-username-status.checking { color: var(--text-secondary); }
        .su-loc-list {
          background: var(--input-bg);
          border-radius: 14px;
          margin-top: 6px;
          overflow: hidden;
          box-shadow: var(--shadow);
        }
        .su-loc-item {
          padding: 14px 18px;
          font-size: 14px;
          color: var(--text-primary);
          cursor: pointer;
          border-bottom: 1px solid var(--border-subtle);
          line-height: 1.4;
          transition: background 0.15s;
          -webkit-tap-highlight-color: transparent;
        }
        .su-loc-item:last-child { border-bottom: none; }
        .su-loc-item:active { background: rgba(56,189,248,0.1); }
        input[type="date"].su-inp { color: var(--text-primary); }
        input[type="date"].su-inp::-webkit-calendar-picker-indicator {
          opacity: 0.45;
          cursor: pointer;
        }
        .su-summary { margin-bottom: 32px; }
        .su-summary-row {
          display: flex;
          flex-direction: column;
          gap: 3px;
          padding: 14px 0;
          border-bottom: 1px solid var(--border-subtle);
        }
        .su-summary-row:first-child { border-top: 1px solid var(--border-subtle); }
        .su-summary-label {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.07em;
          color: var(--text-secondary);
        }
        .su-summary-value {
          font-size: 16px;
          font-weight: 500;
          color: var(--text-primary);
        }
        .su-error {
          color: var(--danger);
          font-size: 13px;
          padding: 10px 14px;
          background: rgba(239,68,68,0.08);
          border-radius: 10px;
          margin-bottom: 14px;
        }
        .su-back {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: none;
          border: none;
          color: var(--text-secondary);
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          padding: 0;
          margin-bottom: 28px;
          -webkit-tap-highlight-color: transparent;
          font-family: inherit;
        }
        .su-btn {
          width: 100%;
          padding: 17px;
          background: var(--btn);
          color: var(--btn-text);
          font-size: 16px;
          font-weight: 700;
          border: none;
          border-radius: 99px;
          cursor: pointer;
          box-shadow: 0 4px 18px rgba(56,189,248,0.38);
          transition: opacity 0.2s, transform 0.15s;
          -webkit-tap-highlight-color: transparent;
          font-family: inherit;
          letter-spacing: 0.01em;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        .su-btn:disabled { opacity: 0.35; cursor: not-allowed; box-shadow: none; }
        .su-btn:not(:disabled):active { transform: scale(0.98); }
        .su-spinner {
          width: 18px;
          height: 18px;
          border: 2px solid rgba(255,255,255,0.4);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
          flex-shrink: 0;
        }
        .su-spacer { flex: 1; min-height: 24px; }
        .su-field-label {
          font-size: 13px;
          color: var(--text-secondary);
          padding-left: 2px;
          display: block;
          margin-bottom: 6px;
          font-weight: 500;
        }
        .su-pass-mismatch {
          color: var(--danger);
          font-size: 13px;
          margin-top: 6px;
          padding-left: 2px;
        }
      `}</style>

      <div className="su-root">
        <div className="su-topbar">
          <span className="su-step-label">Step {step} of 6</span>
        </div>
        <div className="su-progress-track">
          <div className="su-progress-fill" style={{ width: `${(step / 6) * 100}%` }} />
        </div>

        <div className="su-scroll">
          <div className={`su-panel${animating ? " is-animating" : ""}`}>

            {/* STEP 1 */}
            {step === 1 && (
              <>
                <div className="su-logo-block">
                  <Image
                    src="/logo.png"
                    alt="SkyLink Logo"
                    width={64}
                    height={64}
                    priority
                    className="su-logo-img"
                  />
                  <div className="su-logo-name">Sky<span>Link</span></div>
                </div>
                <div className="su-heading">Create your account</div>
                <div className="su-sub">Let&apos;s get started with your basic info.</div>
                <div className="su-input-wrap">
                  <input
                    className="su-inp"
                    type="text"
                    placeholder="Full Name"
                    autoComplete="name"
                    value={form.fullName}
                    onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))}
                    autoFocus
                  />
                </div>
                <div className="su-spacer" />
                <button className="su-btn" disabled={!canProceed()} onClick={() => goToStep(2, "forward")}>
                  Next
                </button>
              </>
            )}

            {/* STEP 2 */}
            {step === 2 && (
              <>
                <button className="su-back" onClick={() => goToStep(1, "back")}><BackArrow /> Back</button>
                <div className="su-heading">What&apos;s your email?</div>
                <div className="su-sub">You&apos;ll use this to log in.</div>
                <div className="su-input-wrap">
                  <input
                    className="su-inp"
                    type="email"
                    placeholder="Email Address"
                    autoComplete="email"
                    inputMode="email"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    autoFocus
                  />
                </div>
                <div className="su-spacer" />
                <button className="su-btn" disabled={!canProceed()} onClick={() => goToStep(3, "forward")}>
                  Next
                </button>
              </>
            )}

            {/* STEP 3 */}
            {step === 3 && (
              <>
                <button className="su-back" onClick={() => goToStep(2, "back")}><BackArrow /> Back</button>
                <div className="su-heading">Create a password</div>
                <div className="su-sub">Make sure it&apos;s strong and secure.</div>
                <div className="su-input-wrap">
                  <div className="su-inp-row">
                    <input
                      className="su-inp"
                      type={showPass ? "text" : "password"}
                      placeholder="Password"
                      autoComplete="new-password"
                      value={form.password}
                      onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                      autoFocus
                    />
                    <button className="su-eye" type="button" onClick={() => setShowPass(v => !v)}>
                      {showPass ? <EyeOff /> : <EyeOpen />}
                    </button>
                  </div>
                </div>
                <div className="su-input-wrap">
                  <div className="su-inp-row">
                    <input
                      className="su-inp"
                      type={showConfirmPass ? "text" : "password"}
                      placeholder="Confirm Password"
                      autoComplete="new-password"
                      value={form.confirmPassword}
                      onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))}
                    />
                    <button className="su-eye" type="button" onClick={() => setShowConfirmPass(v => !v)}>
                      {showConfirmPass ? <EyeOff /> : <EyeOpen />}
                    </button>
                  </div>
                </div>
                <div className="su-rules">
                  <div className={`su-rule${passValid.minLength ? " ok" : ""}`}><div className="su-rule-dot" /> 8+ Characters</div>
                  <div className={`su-rule${passValid.uppercase ? " ok" : ""}`}><div className="su-rule-dot" /> 1 Uppercase</div>
                  <div className={`su-rule${passValid.lowercase ? " ok" : ""}`}><div className="su-rule-dot" /> 1 Lowercase</div>
                  <div className={`su-rule${passValid.number ? " ok" : ""}`}><div className="su-rule-dot" /> 1 Number</div>
                </div>
                {form.confirmPassword && form.password !== form.confirmPassword && (
                  <p className="su-pass-mismatch">Passwords do not match.</p>
                )}
                <div className="su-spacer" />
                <button className="su-btn" disabled={!canProceed()} onClick={() => goToStep(4, "forward")}>
                  Next
                </button>
              </>
            )}

            {/* STEP 4 */}
            {step === 4 && (
              <>
                <button className="su-back" onClick={() => goToStep(3, "back")}><BackArrow /> Back</button>
                <div className="su-heading">Choose your username</div>
                <div className="su-sub">This will be your unique identity.</div>
                <div className="su-input-wrap">
                  <input
                    className="su-inp"
                    type="text"
                    placeholder="username"
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    value={form.username}
                    onChange={e => setForm(f => ({ ...f, username: e.target.value.toLowerCase() }))}
                    autoFocus
                  />
                  <div className={`su-username-status ${usernameStatus}`}>
                    {usernameStatus === "checking" && (
                      <>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: "spin 0.7s linear infinite" }}>
                          <path d="M21 12a9 9 0 1 1-6.22-8.56" />
                        </svg>
                        Checking…
                      </>
                    )}
                    {usernameStatus === "available" && (
                      <>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        Username Available
                      </>
                    )}
                    {usernameStatus === "taken" && (
                      <>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                        Username Already Taken
                      </>
                    )}
                    {usernameStatus === "invalid" && form.username && (
                      <>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                        Only a–z, 0–9, _ or . (4–20 chars)
                      </>
                    )}
                  </div>
                </div>
                <div className="su-spacer" />
                <button className="su-btn" disabled={!canProceed()} onClick={() => goToStep(5, "forward")}>
                  Next
                </button>
              </>
            )}

            {/* STEP 5 */}
            {step === 5 && (
              <>
                <button className="su-back" onClick={() => goToStep(4, "back")}><BackArrow /> Back</button>
                <div className="su-heading">Where are you from?</div>
                <div className="su-sub">Help people find you.</div>
                <div className="su-input-wrap">
                  <input
                    className="su-inp"
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
                    <p style={{ color: "var(--text-secondary)", fontSize: 13, marginTop: 6, paddingLeft: 2 }}>Searching…</p>
                  )}
                  {showSuggestions && locationSuggestions.length > 0 && (
                    <div className="su-loc-list">
                      {locationSuggestions.map(s => (
                        <div
                          key={s.place_id}
                          className="su-loc-item"
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
                <div className="su-input-wrap" style={{ marginTop: 4 }}>
                  <label className="su-field-label">Date of Birth</label>
                  <input
                    className="su-inp"
                    type="date"
                    value={form.dateOfBirth}
                    max={new Date(Date.now() - 13 * 365.25 * 24 * 3600 * 1000).toISOString().split("T")[0]}
                    onChange={e => setForm(f => ({ ...f, dateOfBirth: e.target.value }))}
                  />
                </div>
                <div className="su-spacer" />
                <button className="su-btn" disabled={!canProceed()} onClick={() => goToStep(6, "forward")}>
                  Next
                </button>
              </>
            )}

            {/* STEP 6 */}
            {step === 6 && (
              <>
                <button className="su-back" onClick={() => goToStep(5, "back")}><BackArrow /> Back</button>
                <div className="su-heading">Almost done!</div>
                <div className="su-sub">Review your info before creating your account.</div>
                <div className="su-summary">
                  {[
                    { label: "Full Name", value: form.fullName },
                    { label: "Email", value: form.email },
                    { label: "Username", value: `@${form.username}` },
                    { label: "Location", value: form.location },
                    { label: "Date of Birth", value: form.dateOfBirth },
                  ].map(row => (
                    <div className="su-summary-row" key={row.label}>
                      <span className="su-summary-label">{row.label}</span>
                      <span className="su-summary-value">{row.value}</span>
                    </div>
                  ))}
                </div>
                {submitError && <div className="su-error">{submitError}</div>}
                <button className="su-btn" disabled={submitting} onClick={handleSubmit}>
                  {submitting
                    ? <><div className="su-spinner" /> Creating Account…</>
                    : "Create Account"
                  }
                </button>
              </>
            )}

          </div>
        </div>
      </div>
    </>
  );
}
