import { useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { Zap, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { clsx } from 'clsx'

export default function Login() {
  const { login, register } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()

  const redirect = params.get('redirect') || '/'
  const initialMode = params.get('mode') === 'register' ? 'register' : 'login'

  const [mode, setMode] = useState(initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'login') {
        await login(email, password)
      } else {
        await register(email, password)
      }
      navigate(redirect, { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#06090E' }}>
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center shadow-lg shadow-brand-900/50">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-white text-xl">FlexEdge</span>
        </div>

        {/* Card */}
        <div className="bg-surface-raised border border-border-subtle rounded-2xl p-6">
          {/* Tab toggle */}
          <div className="flex rounded-lg bg-surface-elevated p-1 mb-6">
            {['login', 'register'].map(m => (
              <button
                key={m}
                onClick={() => { setMode(m); setError('') }}
                className={clsx(
                  'flex-1 py-1.5 rounded-md text-sm font-medium transition-colors',
                  mode === m ? 'bg-brand-600 text-white' : 'text-slate-500 hover:text-slate-300'
                )}
              >
                {m === 'login' ? 'Sign in' : 'Create account'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="input w-full"
                autoFocus
              />
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Password</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={mode === 'register' ? 'Min 8 characters' : '••••••••'}
                  required
                  className="input w-full pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  tabIndex={-1}
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-sm text-negative bg-negative/10 rounded-lg px-3 py-2">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-2.5"
            >
              {loading
                ? 'Loading…'
                : mode === 'login' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          {mode === 'register' && (
            <p className="text-xs text-slate-600 text-center mt-4">
              Free tier: 5 picks/day. Upgrade to Pro anytime.
            </p>
          )}
        </div>

        <p className="text-center text-slate-600 text-xs mt-4">
          <Link to="/" className="hover:text-slate-400 transition-colors">← Back to home</Link>
        </p>
      </div>
    </div>
  )
}
