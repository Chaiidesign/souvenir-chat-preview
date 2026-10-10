'use client'

import { useState } from 'react'

type Variant = 'conversation' | 'structured' | 'composed'
type Density = 'compact' | 'comfortable'

const facts = {
  currentRevenue: 43840,
  previousRevenue: 49820,
  ordersCurrent: 812,
  ordersPrevious: 901,
  sessionsCurrent: 32600,
  sessionsPrevious: 38900,
  conversionCurrent: 2.49,
  conversionPrevious: 2.32,
  aovCurrent: 54,
  aovPrevious: 55.29,
  source: 'Illustrative store data — not connected to Shopify',
}

const currency = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
const pct = (a: number, b: number) => ((a / b - 1) * 100).toFixed(1)
const decline = pct(facts.currentRevenue, facts.previousRevenue)
const percent = (n: number) => n.toFixed(2) + '%'

const palette = {
  ink: '#252623', muted: '#73766f', line: '#e8e8e2', paper: '#ffffff',
  bg: '#f8f8f5', accent: '#235b49', pale: '#e9f1ec', negative: '#b24a39',
}
const card: React.CSSProperties = { background: palette.paper, border: '1px solid ' + palette.line, borderRadius: 12, padding: 20 }
const label: React.CSSProperties = { color: palette.muted, fontSize: 12, letterSpacing: '0.03em' }
const button: React.CSSProperties = { border: '1px solid ' + palette.line, background: '#fff', color: palette.ink, borderRadius: 8, padding: '9px 13px', cursor: 'pointer', fontSize: 13 }

function Metric({ name, value, delta, danger = true }: { name: string; value: string; delta: string; danger?: boolean }) {
  return <div style={{ ...card, minWidth: 0, flex: 1 }}>
    <div style={label}>{name}</div>
    <div style={{ fontSize: 28, fontWeight: 570, margin: '7px 0' }}>{value}</div>
    <div style={{ fontSize: 13, color: danger ? palette.negative : palette.accent }}>{delta} versus previous week</div>
  </div>
}
function Evidence({ compact = false }: { compact?: boolean }) {
  return <section style={{ ...card, marginTop: 12, padding: compact ? 14 : 20 }}>
    <div style={{ ...label, marginBottom: 11 }}>EVIDENCE · COMPARABLE 7-DAY WINDOWS</div>
    <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
      <thead><tr>{['Metric', 'Previous', 'Current', 'Change'].map(x => <th key={x} style={{ color: palette.muted, padding: '9px 12px 9px 0', borderBottom: '1px solid ' + palette.line, fontWeight: 500 }}>{x}</th>)}</tr></thead>
      <tbody>{[
        ['Revenue', currency(facts.previousRevenue), currency(facts.currentRevenue), decline + '%'],
        ['Orders', String(facts.ordersPrevious), String(facts.ordersCurrent), pct(facts.ordersCurrent, facts.ordersPrevious) + '%'],
        ['Sessions', facts.sessionsPrevious.toLocaleString(), facts.sessionsCurrent.toLocaleString(), pct(facts.sessionsCurrent, facts.sessionsPrevious) + '%'],
        ['Conversion', percent(facts.conversionPrevious), percent(facts.conversionCurrent), '+' + (facts.conversionCurrent - facts.conversionPrevious).toFixed(2) + ' pp'],
      ].map(row => <tr key={row[0]}>{row.map((cell, i) => <td key={i} style={{ padding: '11px 12px 11px 0', borderBottom: '1px solid ' + palette.line, fontWeight: i === 0 ? 600 : 400 }}>{cell}</td>)}</tr>)}</tbody>
    </table></div>
    <p style={{ ...label, margin: '13px 0 0' }}>{facts.source}. No causal attribution is established by this comparison.</p>
  </section>
}
function Conversation() {
  return <div>
    <p style={{ fontSize: 16, lineHeight: 1.75, marginTop: 0 }}><strong>Revenue fell {Math.abs(Number(decline)).toFixed(1)}%</strong> compared with the previous week, from {currency(facts.previousRevenue)} to {currency(facts.currentRevenue)}.</p>
    <p style={{ lineHeight: 1.75 }}>The clearest related change is traffic: sessions dropped {Math.abs(Number(pct(facts.sessionsCurrent, facts.sessionsPrevious))).toFixed(1)}%, while conversion improved slightly. That makes lower traffic a plausible contributor, but not a verified root cause.</p>
    <p style={{ lineHeight: 1.75 }}>I would compare sessions by acquisition channel and check whether campaign spend, tracking, or attribution changed before recommending a budget adjustment.</p>
    <details style={{ marginTop: 22 }}><summary style={{ cursor: 'pointer', color: palette.accent }}>Show underlying numbers</summary><Evidence compact /></details>
  </div>
}
function Structured() {
  return <div>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
      <Metric name="Revenue" value={currency(facts.currentRevenue)} delta={decline + '%'} />
      <Metric name="Sessions" value={facts.sessionsCurrent.toLocaleString()} delta={pct(facts.sessionsCurrent, facts.sessionsPrevious) + '%'} />
      <Metric name="Conversion" value={percent(facts.conversionCurrent)} delta={'+' + (facts.conversionCurrent - facts.conversionPrevious).toFixed(2) + ' pp'} danger={false} />
    </div>
    <Evidence />
    <div style={{ ...card, marginTop: 12, background: '#fcfcfa' }}><div style={label}>INTERPRETATION</div><p style={{ marginBottom: 0, lineHeight: 1.65 }}>Traffic fell; conversion rose slightly. Investigate acquisition before concluding why traffic changed.</p></div>
  </div>
}
function Composed() {
  const [showEvidence, setShowEvidence] = useState(false)
  const [showNext, setShowNext] = useState(false)
  return <div>
    <div style={{ ...card, background: palette.pale, borderColor: '#d5e4d9' }}>
      <div style={{ ...label, color: palette.accent }}>PRIMARY FINDING</div>
      <div style={{ fontSize: 26, margin: '8px 0', lineHeight: 1.25, fontWeight: 600 }}>Revenue is down {Math.abs(Number(decline)).toFixed(1)}%.</div>
      <div style={{ lineHeight: 1.65 }}>Fewer sessions are a likely contributor. The cause of that traffic reduction is not yet established.</div>
    </div>
    <div style={{ ...card, marginTop: 12 }}>
      <div style={label}>REVENUE · PREVIOUS VS CURRENT WEEK</div>
      <div style={{ marginTop: 17 }}>
        {[
          ['Previous', facts.previousRevenue, '#c4cdc5'],
          ['Current', facts.currentRevenue, palette.accent],
        ].map(([name, amount, color]) => <div key={String(name)} style={{ display: 'grid', gridTemplateColumns: '75px 1fr 72px', gap: 10, alignItems: 'center', margin: '12px 0', fontSize: 13 }}>
          <span>{name}</span><div style={{ background: '#f0f1ee', height: 17, borderRadius: 3 }}><div style={{ height: '100%', background: String(color), width: (Number(amount) / facts.previousRevenue * 100) + '%', borderRadius: 3 }} /></div><span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{currency(Number(amount))}</span>
        </div>)}
      </div>
    </div>
    <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
      <button style={button} onClick={() => setShowEvidence(!showEvidence)} aria-expanded={showEvidence}>{showEvidence ? 'Hide' : 'Inspect'} evidence</button>
      <button style={{ ...button, background: palette.accent, color: 'white', borderColor: palette.accent }} onClick={() => setShowNext(!showNext)} aria-expanded={showNext}>Investigate next steps</button>
    </div>
    {showEvidence && <Evidence />}
    {showNext && <div style={{ ...card, marginTop: 12 }}><strong>Suggested investigation</strong><p style={{ lineHeight: 1.65 }}>Compare sessions by channel, check campaign changes, then verify analytics instrumentation. This prototype does not execute store actions.</p></div>}
  </div>
}

const options: { id: Variant; title: string; sub: string }[] = [
  { id: 'conversation', title: 'Conversational', sub: 'Text first · evidence on demand' },
  { id: 'structured', title: 'Structured', sub: 'Metrics + table + interpretation' },
  { id: 'composed', title: 'Composed', sub: 'Finding + visualization + progressive disclosure' },
]
export default function ExperienceGallery() {
  const [variant, setVariant] = useState<Variant>('conversation')
  const [density, setDensity] = useState<Density>('comfortable')
  const [ratings, setRatings] = useState<Record<Variant, number | undefined>>({ conversation: undefined, structured: undefined, composed: undefined })
  return <main style={{ background: palette.bg, minHeight: '100vh', color: palette.ink, fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, sans-serif', padding: '30px 18px 100px' }}>
    <div style={{ maxWidth: 1050, margin: '0 auto' }}>
      <header style={{ marginBottom: 32 }}>
        <div style={{ ...label, textTransform: 'uppercase', letterSpacing: '0.12em' }}>Souvenir · Experience Laboratory / 001</div>
        <h1 style={{ fontSize: 'clamp(27px, 4vw, 42px)', fontWeight: 590, letterSpacing: '-0.045em', margin: '12px 0 8px' }}>One answer. Three experiences.</h1>
        <p style={{ maxWidth: 620, lineHeight: 1.7, color: palette.muted, margin: 0 }}>Explore what deserves a conversation, a proven pattern, or adaptive composition. All views share the same illustrative evidence and uncertainty.</p>
      </header>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
        {options.map(x => <button key={x.id} onClick={() => setVariant(x.id)} aria-pressed={variant === x.id} style={{ ...card, textAlign: 'left', cursor: 'pointer', borderColor: variant === x.id ? palette.accent : palette.line, boxShadow: variant === x.id ? '0 0 0 1px ' + palette.accent : 'none' }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{x.title}</div><div style={{ ...label, marginTop: 7 }}>{x.sub}</div>
        </button>)}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 15, alignItems: 'center', margin: '23px 0 10px', flexWrap: 'wrap' }}>
        <div style={label}>MERCHANT SCENARIO · REVENUE DIAGNOSIS</div>
        <div style={{ display: 'flex', gap: 5 }}><button style={{ ...button, background: density === 'compact' ? '#e7ebe6' : '#fff' }} onClick={() => setDensity('compact')}>Compact</button><button style={{ ...button, background: density === 'comfortable' ? '#e7ebe6' : '#fff' }} onClick={() => setDensity('comfortable')}>Comfortable</button></div>
      </div>
      <section style={{ ...card, padding: density === 'compact' ? 20 : 'clamp(22px, 5vw, 48px)' }}>
        <div style={{ ...label, marginBottom: 9 }}>MERCHANT</div>
        <h2 style={{ fontSize: 23, fontWeight: 570, lineHeight: 1.3, margin: '0 0 22px' }}>Why did my sales fall last week?</h2>
        <div style={{ borderTop: '1px solid ' + palette.line, paddingTop: 22 }}>
          <div style={{ ...label, marginBottom: 15 }}>SOUVENIR · {options.find(x => x.id === variant)?.title.toUpperCase()} RESPONSE</div>
          {variant === 'conversation' ? <Conversation /> : variant === 'structured' ? <Structured /> : <Composed />}
        </div>
      </section>
      <aside style={{ ...card, marginTop: 14, background: '#fefefb' }}>
        <div style={{ fontWeight: 600 }}>Evaluation note</div>
        <p style={{ color: palette.muted, lineHeight: 1.65, fontSize: 13 }}>Which representation makes the finding, uncertainty, and next step clearest? Rate usefulness after trying each view. Ratings are local to this browser session; no telemetry is collected.</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          {[1, 2, 3, 4, 5].map(n => <button aria-label={n + ' out of 5'} aria-pressed={ratings[variant] === n} key={n} style={{ ...button, background: ratings[variant] === n ? palette.pale : '#fff' }} onClick={() => setRatings(p => ({ ...p, [variant]: n }))}>{n}</button>)}
          <span style={{ ...label, marginLeft: 10 }}>{ratings[variant] ? 'Rated ' + ratings[variant] + '/5' : 'Not rated yet'}</span>
        </div>
        <p style={{ ...label, marginTop: 14 }}>Prototype only · illustrative figures · no connected store data, actions, or claims of causality.</p>
      </aside>
    </div>
  </main>
}
