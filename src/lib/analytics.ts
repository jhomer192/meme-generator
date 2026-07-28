/**
 * Umami events. Guarded on every call: the script is deferred and blocked
 * outright for a good share of visitors, and analytics must never be able to
 * break the app.
 *
 * Shared property with jackhomer.com, so a visit here is attributable to
 * whatever sent it.
 */
type Props = Record<string, string | number | boolean>

declare global {
  interface Window {
    umami?: { track: (event: string, data?: Props) => void }
  }
}

export function track(event: string, props?: Props) {
  try {
    window.umami?.track(event, props)
  } catch {
    /* never load-bearing */
  }
}
