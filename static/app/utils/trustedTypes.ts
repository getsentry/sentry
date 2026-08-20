import dompurify from 'dompurify';

declare global {
  interface Window {
    trustedTypes?: {
      createPolicy: (
        name: string,
        rules: {
          createHTML?: (input: string) => string;
          createScript?: (input: string) => string;
          createScriptURL?: (input: string) => string;
        }
      ) => TrustedTypePolicy;
    };
  }

  interface TrustedTypePolicy {
    createHTML: (input: string) => TrustedHTML;
    createScriptURL: (input: string) => TrustedScriptURL;
    name: string;
  }

  interface TrustedHTML {
    toString(): string;
  }

  interface TrustedScriptURL {
    toString(): string;
  }
}

let sentryScriptUrlPolicy: TrustedTypePolicy | null = null;

export function trustedTypesSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.trustedTypes === 'object';
}

export function installTrustedTypesPolicies(): void {
  if (!trustedTypesSupported()) {
    return;
  }

  try {
    dompurify.sanitize('', {RETURN_TRUSTED_TYPE: true});
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Trusted Types: failed to warm dompurify policy', err);
  }

  if (!sentryScriptUrlPolicy) {
    try {
      sentryScriptUrlPolicy = window.trustedTypes!.createPolicy('sentry-script-url', {
        createScriptURL: (input: string) => {
          if (new URL(input, window.location.origin).origin !== window.location.origin) {
            throw new TypeError(`sentry-script-url: refusing cross-origin ${input}`);
          }
          return input;
        },
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Trusted Types: failed to create sentry-script-url policy', err);
    }
  }
}

export function getSentryScriptUrlPolicy(): TrustedTypePolicy | null {
  return sentryScriptUrlPolicy;
}
