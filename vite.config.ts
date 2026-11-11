import { readFileSync } from 'fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'

const { version } = JSON.parse(readFileSync('./package.json', 'utf-8')) as { version: string }

// `--mode web` builds the browser version (dist-web/, no Electron); any other
// mode builds the desktop app.
export default defineConfig(({ mode }) => {
  const define = { __APP_VERSION__: JSON.stringify(version) }

  if (mode === 'web') {
    return {
      base: './',
      define,
      plugins: [react()],
      build: { outDir: 'dist-web' },
    }
  }

  return {
    define,
    plugins: [
      react(),
      electron([
        {
          entry: 'src/main/main.ts',
          vite: {
            build: {
              rollupOptions: {
                external: ['sql.js'],
              },
            },
          },
        },
        {
          entry: 'src/main/preload.ts',
          onstart(args) {
            args.reload()
          },
        },
      ]),
      renderer(),
    ],
  }
})
