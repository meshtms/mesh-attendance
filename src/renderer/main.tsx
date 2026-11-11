import React from 'react'
import ReactDOM from 'react-dom/client'
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import theme from './theme'
import Root from './Root'

async function boot() {
  // The web build has no Electron preload, so it supplies window.electronAPI
  // itself. The mode check is static, so the desktop bundle drops this branch.
  if (import.meta.env.MODE === 'web') {
    const { installWebApi } = await import('../web/webApi')
    await installWebApi()
  }

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Root />
      </ThemeProvider>
    </React.StrictMode>
  )
}

boot().catch((err) => {
  console.error(err)
  document.getElementById('root')!.textContent = `Could not start: ${err instanceof Error ? err.message : String(err)}`
})
