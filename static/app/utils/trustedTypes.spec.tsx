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

// The module under test only calls createPolicy, so the fake leaves out the
// rest of the factory.
function setTrustedTypes(fake: {createPolicy: jest.Mock} | undefined) {
  window.trustedTypes = fake as unknown as TrustedTypePolicyFactory;
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
    setTrustedTypes(undefined);

    const {installTrustedTypesPolicies, trustedScriptUrl} = await loadModule();
    installTrustedTypesPolicies();

    expect(trustedScriptUrl('/service-worker.js')).toBe('/service-worker.js');
  });

  it('registers sentry-script-url when supported', async () => {
    const trustedTypes = fakeTrustedTypes();
    setTrustedTypes(trustedTypes);

    const {installTrustedTypesPolicies} = await loadModule();
    installTrustedTypesPolicies();

    expect(trustedTypes.createPolicy).toHaveBeenCalledWith(
      'sentry-script-url',
      expect.anything()
    );
  });

  it('registers the policy only once', async () => {
    const trustedTypes = fakeTrustedTypes();
    setTrustedTypes(trustedTypes);

    const {installTrustedTypesPolicies} = await loadModule();
    installTrustedTypesPolicies();
    installTrustedTypesPolicies();

    expect(trustedTypes.createPolicy).toHaveBeenCalledTimes(1);
  });

  it('accepts a same-origin script url', async () => {
    setTrustedTypes(fakeTrustedTypes());

    const {installTrustedTypesPolicies, trustedScriptUrl} = await loadModule();
    installTrustedTypesPolicies();

    expect(trustedScriptUrl('/service-worker.js')).toBe('/service-worker.js');
  });

  it('refuses a cross-origin script url', async () => {
    setTrustedTypes(fakeTrustedTypes());

    const {installTrustedTypesPolicies, trustedScriptUrl} = await loadModule();
    installTrustedTypesPolicies();

    expect(() => trustedScriptUrl('https://evil.example.com/x.js')).toThrow(TypeError);
  });

  it('falls back to the raw url when the CSP allowlist rejects the policy', async () => {
    setTrustedTypes({
      createPolicy: jest.fn(() => {
        throw new Error('refused by CSP');
      }),
    });
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    const {installTrustedTypesPolicies, trustedScriptUrl} = await loadModule();
    expect(() => installTrustedTypesPolicies()).not.toThrow();
    expect(trustedScriptUrl('/service-worker.js')).toBe('/service-worker.js');

    consoleError.mockRestore();
  });
});
