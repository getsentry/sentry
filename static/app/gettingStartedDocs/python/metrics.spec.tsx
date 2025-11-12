// Only import and test functions that don't have circular dependencies
const {metrics} = jest.requireActual('sentry/gettingStartedDocs/python/python/metrics');

describe('metrics', () => {
  const mockParams = {
    dsn: {
      public: 'https://test@example.com/123',
    },
  };

  it('generates metrics onboarding config with default parameters', () => {
    const result = metrics();

    // Test install step
    const installSteps = result.install();
    expect(installSteps).toHaveLength(1);
    expect(installSteps[0].type).toBe('install');
    expect(installSteps[0].content).toHaveLength(2);

    // Test configure step
    const configureSteps = result.configure(mockParams);
    expect(configureSteps).toHaveLength(1);
    expect(configureSteps[0].type).toBe('configure');
    expect(configureSteps[0].content[1].code).toContain('sentry_sdk.init');
    expect(configureSteps[0].content[1].code).toContain(mockParams.dsn.public);

    // Test verify step
    const verifySteps = result.verify({isMetricsSelected: true});
    expect(verifySteps).toHaveLength(1);
    expect(verifySteps[0].type).toBe('verify');
    expect(verifySteps[0].content).toHaveLength(1);
    expect(verifySteps[0].content[0].type).toBe('conditional');
    const conditionalContent = verifySteps[0].content[0].content;
    expect(conditionalContent[1].code).toContain('metrics.count');
  });

  it('generates metrics onboarding config with custom parameters', () => {
    const result = metrics({
      packageName: 'custom-sentry-sdk',
      minimumVersion: '3.0.0',
    });

    const installSteps = result.install();
    expect(installSteps[0].content).toHaveLength(2);
  });
});
