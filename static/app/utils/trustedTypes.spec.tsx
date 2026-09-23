type Rules = {createScriptURL?: (input: string) => string};

function fakeTrustedTypes() {
  return {
    createPolicy: jest.fn((name: string, rules: Rules) => ({
      name,
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

  it('does nothing when Trusted Types is unsupported', async () => {
    window.trustedTypes = undefined;

    const {installTrustedTypesPolicies, getSentryScriptUrlPolicy} = await loadModule();
    installTrustedTypesPolicies();

    expect(getSentryScriptUrlPolicy()).toBeNull();
  });

  it('registers sentry-script-url when supported', async () => {
    const trustedTypes = fakeTrustedTypes();
    window.trustedTypes = trustedTypes;

    const {installTrustedTypesPolicies, getSentryScriptUrlPolicy} = await loadModule();
    installTrustedTypesPolicies();

    expect(trustedTypes.createPolicy).toHaveBeenCalledWith(
      'sentry-script-url',
      expect.anything()
    );
    expect(getSentryScriptUrlPolicy()?.name).toBe('sentry-script-url');
  });

  it('registers the policy only once', async () => {
    const trustedTypes = fakeTrustedTypes();
    window.trustedTypes = trustedTypes;

    const {installTrustedTypesPolicies} = await loadModule();
    installTrustedTypesPolicies();
    installTrustedTypesPolicies();

    expect(trustedTypes.createPolicy).toHaveBeenCalledTimes(1);
  });

  it('accepts a same-origin script URL', async () => {
    window.trustedTypes = fakeTrustedTypes();

    const {installTrustedTypesPolicies, getSentryScriptUrlPolicy} = await loadModule();
    installTrustedTypesPolicies();

    expect(getSentryScriptUrlPolicy()?.createScriptURL('/service-worker.js')).toBe(
      '/service-worker.js'
    );
  });

  it('refuses a cross-origin script URL', async () => {
    window.trustedTypes = fakeTrustedTypes();

    const {installTrustedTypesPolicies, getSentryScriptUrlPolicy} = await loadModule();
    installTrustedTypesPolicies();

    expect(() =>
      getSentryScriptUrlPolicy()?.createScriptURL('https://evil.example.com/x.js')
    ).toThrow(TypeError);
  });

  it('survives a policy the CSP allowlist rejects', async () => {
    window.trustedTypes = {
      createPolicy: jest.fn(() => {
        throw new Error('refused by CSP');
      }),
    };
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    const {installTrustedTypesPolicies, getSentryScriptUrlPolicy} = await loadModule();
    expect(() => installTrustedTypesPolicies()).not.toThrow();
    expect(getSentryScriptUrlPolicy()).toBeNull();

    consoleError.mockRestore();
  });
});
