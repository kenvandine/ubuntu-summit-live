import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages serves the app from /<repo>/. Override with BASE_PATH if hosted elsewhere.
const base = process.env.BASE_PATH ?? '/ubuntu-summit-live/'

export default defineConfig({
  base,
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
  css: {
    preprocessorOptions: {
      scss: {
        loadPaths: ['node_modules'],
        quietDeps: true,
        silenceDeprecations: ['import', 'global-builtin', 'color-functions', 'if-function'],
      },
    },
  },
  plugins: [
    svelte(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        id: base,
        name: 'Ubuntu Summit Live',
        short_name: 'Summit Live',
        description: 'Live chat and streams for Ubuntu Summit talks.',
        start_url: base,
        scope: base,
        display: 'standalone',
        background_color: '#2c001e',
        theme_color: '#2c001e',
        categories: ['social', 'events'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icons/icon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: `${base}index.html`,
        // Never let the service worker answer the Discourse sign-in callback from cache
        // with stale state; it still serves index.html, which reads ?payload itself.
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            // Ubuntu font and other Canonical assets used by Vanilla
            urlPattern: ({ url }) => url.origin === 'https://assets.ubuntu.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'ubuntu-assets',
              expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ url }) => url.pathname.endsWith('/rooms.json'),
            handler: 'NetworkFirst',
            options: { cacheName: 'rooms' },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
})
