import dompurify from 'dompurify';

let sentryScriptUrlPolicy: Pick<TrustedTypePolicy, 'createScriptURL'> | null = null;
let externalScriptUrlPolicy: Pick<TrustedTypePolicy, 'createScriptURL'> | null = null;

// Third-party hosts we load scripts from. Add a host only together with the
// code that loads it, so every entry has a caller.
const EXTERNAL_SCRIPT_HOSTS = new Set(['plausible.io']);

/**
 * Registers the Trusted Types policies the app mints values through. A policy
 * must validate or sanitize — never pass its input through — or it launders
 * exactly what Trusted Types is meant to catch.
 *
 * `sentry-script-url` rejects anything cross-origin, so a script URL can only
 * ever point back at us. `sentry-external-script-url` is its counterpart for
 * third-party scripts: https only, and only from `EXTERNAL_SCRIPT_HOSTS`.
 */
export function installTrustedTypesPolicies(): void {
  if (typeof window === 'undefined' || typeof window.trustedTypes !== 'object') {
    return;
  }

  if (sentryScriptUrlPolicy) {
    return;
  }

  try {
    // DOMPurify creates its `dompurify` policy lazily on first use. Force it
    // here so a name missing from the CSP allowlist surfaces at boot rather
    // than the first time something renders markdown.
    dompurify.sanitize('', {RETURN_TRUSTED_TYPE: true});
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Trusted Types: failed to warm the dompurify policy', err);
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

  try {
    externalScriptUrlPolicy = window.trustedTypes.createPolicy(
      'sentry-external-script-url',
      {
        createScriptURL: (input: string) => {
          const url = new URL(input);
          if (url.protocol !== 'https:' || !EXTERNAL_SCRIPT_HOSTS.has(url.hostname)) {
            throw new TypeError(`sentry-external-script-url: refusing ${input}`);
          }
          return input;
        },
      }
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(
      'Trusted Types: failed to create sentry-external-script-url policy',
      err
    );
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

/**
 * Sets a third-party script's `src` through `sentry-external-script-url`.
 */
export function setExternalScriptSrc(script: HTMLScriptElement, url: string): void {
  // The DOM lib types `src` as string-only; the browser accepts a TrustedScriptURL.
  script.src = (externalScriptUrlPolicy?.createScriptURL(url) ?? url) as string;
}
