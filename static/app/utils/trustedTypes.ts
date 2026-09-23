declare global {
  interface Window {
    trustedTypes?: {
      createPolicy: (
        name: string,
        rules: {createScriptURL?: (input: string) => string}
      ) => TrustedTypePolicy;
    };
  }

  interface TrustedTypePolicy {
    createScriptURL: (input: string) => TrustedScriptURL;
    name: string;
  }

  interface TrustedScriptURL {
    toString(): string;
  }
}

let sentryScriptUrlPolicy: TrustedTypePolicy | null = null;

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
 * Mints a script URL through `sentry-script-url`, returning the input unchanged
 * when Trusted Types is unavailable.
 *
 * Under enforcement this is a `TrustedScriptURL`, which is what the sink needs,
 * but it is typed as a string: the DOM declares these sinks as strings, so a
 * caller could not hand the real type to one without asserting at every site.
 */
export function trustedScriptUrl(url: string): string {
  return (sentryScriptUrlPolicy?.createScriptURL(url) ?? url) as unknown as string;
}
