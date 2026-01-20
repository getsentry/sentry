// Only import and test functions that don't have circular dependencies
const {dotnetLogs} = jest.requireActual('sentry/gettingStartedDocs/dotnet/logs');

describe('logs', () => {
  const mockParams = {
    dsn: {
      public: 'https://test@example.com/123',
    },
    sourcePackageRegistries: {
      isLoading: false,
    },
  };

  it('generates logs onboarding config with default parameters', () => {
    const result = dotnetLogs();

    // Test install step
    const installSteps = result.install(mockParams);
    expect(installSteps).toHaveLength(1);
    expect(installSteps[0].type).toBe('install');
    expect(installSteps[0].content).toHaveLength(2);

    // Test configure step
    const configureSteps = result.configure(mockParams);
    expect(configureSteps).toHaveLength(1);
    expect(configureSteps[0].type).toBe('configure');
    expect(configureSteps[0].content[1].code).toContain('o.EnableLogs = true;');
    expect(configureSteps[0].content[1].code).toContain(mockParams.dsn.public);

    // Test verify step
    const verifySteps = result.verify({isLogsSelected: true});
    expect(verifySteps).toHaveLength(1);
    expect(verifySteps[0].type).toBe('verify');
    expect(verifySteps[0].content).toHaveLength(1);
    expect(verifySteps[0].content[0].type).toBe('conditional');
    const conditionalContent = verifySteps[0].content[0].content;
    expect(conditionalContent[1].code).toContain('SentrySdk.Logger.LogInfo');
  });
});
