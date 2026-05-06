import { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import './LoginPage.css';

type State = 'idle' | 'loading' | 'sent' | 'error';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<State>('idle');
  const [errMsg, setErrMsg] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setState('loading');
    setErrMsg('');

    const { error } = await supabase!.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: false },
    });

    if (error) {
      setState('error');
      setErrMsg(error.message);
    } else {
      setState('sent');
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-logo">
          <span className="login-logo-nix">NIx</span>
          <span className="login-logo-trace">Trace</span>
          <span className="login-logo-tag">5G SA</span>
        </div>

        <p className="login-subtitle">
          Invitation-only access. Enter your email and we'll send a sign-in link.
        </p>

        {state === 'sent' ? (
          <div className="login-sent">
            <div className="login-sent-icon">✓</div>
            <p>Check your inbox at <strong>{email}</strong></p>
            <p className="login-sent-hint">Click the link in the email to sign in.</p>
          </div>
        ) : (
          <form className="login-form" onSubmit={handleSubmit}>
            <input
              className="login-input"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={state === 'loading'}
              autoFocus
              required
            />
            <button
              className="login-btn"
              type="submit"
              disabled={state === 'loading' || !email.trim()}
            >
              {state === 'loading' ? 'Sending…' : 'Send login link'}
            </button>
            {state === 'error' && (
              <p className="login-error">{errMsg || 'Something went wrong. Try again.'}</p>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
