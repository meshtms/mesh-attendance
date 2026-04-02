import { useState } from 'react'
import type { ImportResult } from '../../shared/types'

function ImportView() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleImport = async () => {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await window.electronAPI.importCSV()
      if (res) {
        setResult(res)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <button
        onClick={handleImport}
        disabled={loading}
        style={{
          padding: '0.6rem 1.2rem',
          fontSize: '1rem',
          cursor: loading ? 'not-allowed' : 'pointer',
        }}
      >
        {loading ? 'Importing...' : 'Import CSV'}
      </button>

      {result && (
        <div style={{ marginTop: '1.5rem' }}>
          <table style={{ borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td style={{ padding: '0.3rem 1rem', fontWeight: 'bold' }}>Total rows</td>
                <td style={{ padding: '0.3rem 1rem' }}>{result.total.toLocaleString()}</td>
              </tr>
              <tr>
                <td style={{ padding: '0.3rem 1rem', fontWeight: 'bold' }}>Inserted</td>
                <td style={{ padding: '0.3rem 1rem' }}>{result.inserted.toLocaleString()}</td>
              </tr>
              <tr>
                <td style={{ padding: '0.3rem 1rem', fontWeight: 'bold' }}>Duplicates skipped</td>
                <td style={{ padding: '0.3rem 1rem' }}>{result.skipped.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {error && (
        <div style={{ marginTop: '1rem', color: 'red' }}>{error}</div>
      )}
    </div>
  )
}

export default ImportView
