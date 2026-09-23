type Rules = {
  createHTML?: (input: string) => string;
  createScriptURL?: (input: string) => string;
};

// DOMPurify registers its own `dompurify` policy through this same object, so
// the fake has to provide createHTML as well as createScriptURL.
function fakeTrustedTypes() {
  return {
    createPolicy: jest.fn((name: string, rules: Rules) => ({
      name,
      createHTML: (input: string) =>
        (rules.createHTML?.(input) ?? input) as unknown as TrustedHTML,
      createScriptURL: (input: string) =>
        rules.createScriptURL?.(input) as unknown as TrustedScriptURL,
    })),
  };
}

async function loadModule() {
  jest.resetModules();
  return await import('sentry/utils/trustedTypes');
}

describe('trustedTypes', () => {
  const original = window.trustedTypes;

  afterEach(() => {
    window.trustedTypes = original;
  });

  it('returns the url unchanged when Trusted Types is unsupported', async () => {
    window.trustedTypes = undefined;

    const {installTrustedTypesPolicies, trustedScriptUrl} = await loadModule();
    installTrustedTypesPolicies();

    expect(trustedScriptUrl('/service-worker.js')).toBe('/service-worker.js');
  });

  it('registers sentry-script-url when supported', async () => {
    const trustedTypes = fakeTrustedTypes();
    window.trustedTypes = trustedTypes;

    const {installTrustedTypesPolicies} = await loadModule();
    installTrustedTypesPolicies();

    expect(trustedTypes.createPolicy).toHaveBeenCalledWith(
      'sentry-script-url',
      expect.anything()
    );
  });

  it('registers the policy only once', async () => {
    const trustedTypes = fakeTrustedTypes();
    window.trustedTypes = trustedTypes;

    const {installTrustedTypesPolicies} = await loadModule();
    installTrustedTypesPolicies();
    installTrustedTypesPolicies();

    const ourCalls = trustedTypes.createPolicy.mock.calls.filter(
      ([name]) => name === 'sentry-script-url'
    );
    expect(ourCalls).toHaveLength(1);
  });

  it('accepts a same-origin script url', async () => {
    window.trustedTypes = fakeTrustedTypes();

    const {installTrustedTypesPolicies, trustedScriptUrl} = await loadModule();
    installTrustedTypesPolicies();

    expect(trustedScriptUrl('/service-worker.js')).toBe('/service-worker.js');
  });

  it('refuses a cross-origin script url', async () => {
    window.trustedTypes = fakeTrustedTypes();

    const {installTrustedTypesPolicies, trustedScriptUrl} = await loadModule();
    installTrustedTypesPolicies();

    expect(() => trustedScriptUrl('https://evil.example.com/x.js')).toThrow(TypeError);
  });

  it('warms the dompurify policy so a rejected name surfaces at boot', async () => {
    window.trustedTypes = fakeTrustedTypes();

    // Reset before importing either, so the module under test resolves the same
    // dompurify instance the spy is attached to.
    jest.resetModules();
    const dompurify = (await import('dompurify')).default;
    const sanitize = jest.spyOn(dompurify, 'sanitize');
    const {installTrustedTypesPolicies} = await import('sentry/utils/trustedTypes');

    installTrustedTypesPolicies();

    expect(sanitize).toHaveBeenCalledWith('', {RETURN_TRUSTED_TYPE: true});

    sanitize.mockRestore();
  });

  it('falls back to the raw url when the CSP allowlist rejects the policy', async () => {
    window.trustedTypes = {
      createPolicy: jest.fn(() => {
        throw new Error('refused by CSP');
      }),
    };
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    const {installTrustedTypesPolicies, trustedScriptUrl} = await loadModule();
    expect(() => installTrustedTypesPolicies()).not.toThrow();
    expect(trustedScriptUrl('/service-worker.js')).toBe('/service-worker.js');

    consoleError.mockRestore();
  });
});
