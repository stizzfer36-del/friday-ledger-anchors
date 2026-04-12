import { useEffect, useState } from 'react'
import { DollarSign, TrendingUp, TrendingDown, Plus } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { api } from '../api'
import { clsx } from 'clsx'

export default function Bankroll() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ type: 'deposit', amount: '', note: '' })
  const [saving, setSaving] = useState(false)

  const load = async () => {
    try {
      const result = await api.bankroll.get()
      setData(result)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleAdd = async () => {
    if (!form.amount) return
    setSaving(true)
    try {
      const amount = form.type === 'withdrawal' || form.type === 'loss'
        ? -Math.abs(parseFloat(form.amount))
        : Math.abs(parseFloat(form.amount))
      await api.bankroll.addEntry({ type: form.type, amount, note: form.note })
      setForm({ type: 'deposit', amount: '', note: '' })
      setShowForm(false)
      await load()
    } finally {
      setSaving(false)
    }
  }

  const chartData = buildRunningBalance(data?.entries || [])
  const summary = data?.summary || {}

  return (
    <div className="max-w-4xl mx-auto space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-white">Bankroll</h2>
          <p className="text-sm text-slate-600">Track your P&L and account history</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary text-xs h-8 gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Add Entry
        </button>
      </div>

      {/* Add entry form */}
      {showForm && (
        <div className="card p-4 animate-slide-up">
          <p className="text-sm font-semibold text-white mb-3">New Entry</p>
          <div className="flex flex-wrap gap-3">
            <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className="input text-xs h-8">
              <option value="deposit">Deposit</option>
              <option value="withdrawal">Withdrawal</option>
              <option value="win">Win</option>
              <option value="loss">Loss</option>
            </select>
            <input
              type="number"
              placeholder="Amount"
              value={form.amount}
              onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              className="input text-xs h-8 w-28 font-mono"
              min="0"
            />
            <input
              type="text"
              placeholder="Note (optional)"
              value={form.note}
              onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
              className="input text-xs h-8 flex-1 min-w-32"
            />
            <button onClick={handleAdd} disabled={saving} className="btn-primary text-xs h-8 px-4">
              {saving ? 'Saving…' : 'Add'}
            </button>
            <button onClick={() => setShowForm(false)} className="btn-ghost text-xs h-8">Cancel</button>
          </div>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard label="Balance" value={`$${(summary.balance || 0).toFixed(2)}`} positive={summary.balance >= 0} />
        <SummaryCard label="Total In" value={`$${(summary.deposits || 0).toFixed(2)}`} />
        <SummaryCard label="Winnings" value={`$${(summary.winnings || 0).toFixed(2)}`} positive={summary.winnings >= 0} />
        <SummaryCard label="ROI" value={`${(summary.roi || 0).toFixed(1)}%`} positive={summary.roi >= 0} />
      </div>

      {/* Balance chart */}
      {chartData.length > 1 && (
        <div className="card p-4">
          <p className="text-sm font-semibold text-white mb-4">Running Balance</p>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <XAxis dataKey="index" hide />
                <YAxis tick={{ fill: '#4B5563', fontSize: 10 }} axisLine={false} tickLine={false} width={48}
                  tickFormatter={v => `$${v}`} />
                <ReferenceLine y={0} stroke="#1A2D40" strokeDasharray="3 3" />
                <Tooltip
                  contentStyle={{ background: '#0C1118', border: '1px solid #1A2D40', borderRadius: 6, fontSize: 11 }}
                  formatter={v => [`$${v.toFixed(2)}`, 'Balance']}
                />
                <Line type="monotone" dataKey="balance" stroke="#3B82F6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* History */}
      {loading ? (
        <div className="py-12 text-center text-slate-600 text-sm">Loading…</div>
      ) : (data?.entries?.length || 0) === 0 ? (
        <div className="card py-12 text-center">
          <p className="text-slate-500 text-sm">No entries yet. Add a deposit to get started.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border-subtle">
            <span className="text-xs font-semibold text-white">History</span>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th className="text-right">Amount</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {(data?.entries || []).map(entry => (
                <tr key={entry.id}>
                  <td className="font-mono text-xs text-slate-500">
                    {new Date(entry.createdAt).toLocaleDateString()}
                  </td>
                  <td>
                    <span className={clsx(
                      'text-xs font-medium capitalize px-1.5 py-0.5 rounded',
                      entry.type === 'win' ? 'text-positive bg-positive/10' :
                      entry.type === 'loss' ? 'text-ev-fade bg-ev-fade/10' :
                      entry.type === 'deposit' ? 'text-brand-400 bg-brand-500/10' :
                      'text-slate-400 bg-surface-elevated'
                    )}>
                      {entry.type}
                    </span>
                  </td>
                  <td className={clsx(
                    'text-right font-mono text-sm',
                    entry.amount >= 0 ? 'text-positive' : 'text-ev-fade'
                  )}>
                    {entry.amount >= 0 ? '+' : ''}${Math.abs(entry.amount).toFixed(2)}
                  </td>
                  <td className="text-xs text-slate-600">{entry.note || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function SummaryCard({ label, value, positive }) {
  return (
    <div className="card p-4">
      <p className="section-label mb-2">{label}</p>
      <p className={clsx(
        'font-mono text-xl font-bold',
        positive === true ? 'text-positive' : positive === false ? 'text-ev-fade' : 'text-white'
      )}>
        {value}
      </p>
    </div>
  )
}

function buildRunningBalance(entries) {
  let balance = 0
  return [...entries].reverse().map((e, i) => {
    balance += e.amount
    return { index: i, balance }
  })
}
