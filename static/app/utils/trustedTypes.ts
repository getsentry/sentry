let sentryScriptUrlPolicy: Pick<TrustedTypePolicy, 'createScriptURL'> | null = null;

/**
 * Registers the Trusted Types policies the app mints values through. A policy
 * must validate or sanitize — never pass its input through — or it launders
 * exactly what Trusted Types is meant to catch.
 *
 * `sentry-script-url` rejects anything cross-origin, so a script URL can only
 * ever point back at us.
 */
export function installTrustedTypesPolicies(): void {
  if (typeof window === 'undefined' || typeof window.trustedTypes !== 'object') {
    return;
  }

  if (sentryScriptUrlPolicy) {
    return;
  }

  try {
    sentryScriptUrlPolicy = window.trustedTypes.createPolicy('sentry-script-url', {
      createScriptURL: (input: string) => {
        if (new URL(input, window.location.origin).origin !== window.location.origin) {
          throw new TypeError(`sentry-script-url: refusing cross-origin ${input}`);
        }
        return input;
      },
    });
  } catch (err) {
    // A name missing from the CSP `trusted-types` allowlist throws here. Let the
    // app boot; the sinks that need the policy fall back to their raw string.
    // eslint-disable-next-line no-console
    console.error('Trusted Types: failed to create sentry-script-url policy', err);
  }
}

/**
 * Mints a script URL through `sentry-script-url`.
 *
 * Without Trusted Types the sinks accept plain strings, so the raw URL stands in
 * for the trusted value and callers only ever have to handle one type.
 */
export function trustedScriptUrl(url: string): TrustedScriptURL {
  return (
    sentryScriptUrlPolicy?.createScriptURL(url) ?? (url as unknown as TrustedScriptURL)
  );
}
