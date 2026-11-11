/**
 * A readable message from a thrown value. Electron wraps main-process errors
 * as "Error invoking remote method 'x': Error: <message>"; keep only the message.
 */
export function errorMessage(err: unknown): string {
  return (err instanceof Error ? err.message : String(err)).replace(
    /^Error invoking remote method '[^']+': (Error: )?/,
    '',
  )
}
