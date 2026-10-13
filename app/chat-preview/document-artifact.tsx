'use client'

import { useEffect, useState } from 'react'

export default function DocumentArtifact({ title, pdfUrl, onComplete }: {
  title: string
  pdfUrl: string
  onComplete: () => void
}) {
  const [showPreview, setShowPreview] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(onComplete, 380)
    return () => window.clearTimeout(timer)
  }, [onComplete])

  return (
    <section aria-label="Document for review" style={{ border: '1px solid #DFD4CA', borderRadius: 12, background: '#fff', maxWidth: 700, overflow: 'hidden' }}>
      <div style={{ padding: '18px 20px', display: 'flex', gap: 18, justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#805C32', textTransform: 'uppercase', letterSpacing: '.06em' }}>Draft · Sample data</div>
          <h3 style={{ margin: '5px 0 4px', fontSize: 18, color: '#26211E' }}>{title}</h3>
          <p style={{ margin: 0, fontSize: 13, color: '#665F59' }}>Review the exact PDF before downloading. Nothing has been sent.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button type="button" aria-expanded={showPreview} onClick={() => setShowPreview(value => !value)} style={{ border: '1px solid #CFC0B1', borderRadius: 9, padding: '9px 12px', background: '#fff', color: '#45382F', cursor: 'pointer' }}>
            {showPreview ? 'Hide preview' : 'Preview PDF'}
          </button>
          <a href={pdfUrl} download="TEST-INV-1042-draft.pdf" style={{ borderRadius: 9, padding: '9px 12px', background: '#683D1B', color: '#fff', textDecoration: 'none' }}>Download</a>
        </div>
      </div>
      {showPreview && <iframe title={`${title} PDF preview`} src={pdfUrl} style={{ display: 'block', border: 0, borderTop: '1px solid #DFD4CA', width: '100%', height: 520 }} />}
      <div style={{ borderTop: '1px solid #EFE6DD', padding: '10px 20px', fontSize: 12, color: '#665F59' }}>
        Design prototype · Fixed synthetic file · USD 408.00 items subtotal · Missing fields require review
      </div>
    </section>
  )
}
