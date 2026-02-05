// Only import and test functions that don't have circular dependencies
const {metrics} = jest.requireActual('sentry/gettingStartedDocs/dotnet/metrics');

describe('metrics', () => {
  const mockParams = {
    dsn: {
      public: 'https://test@example.com/123',
    },
    sourcePackageRegistries: {
      isLoading: false,
    },
  };

  it('generates metrics onboarding config with default parameters', () => {
    const result = metrics();

    // Test install step
    const installSteps = result.install(mockParams);
    expect(installSteps).toHaveLength(1);
    expect(installSteps[0].type).toBe('install');
    expect(installSteps[0].content).toHaveLength(2);

    // Test verify step
    const verifySteps = result.verify(mockParams);
    expect(verifySteps).toHaveLength(1);
    expect(verifySteps[0].type).toBe('verify');
    expect(verifySteps[0].content).toHaveLength(3);
    const codeSnippet = verifySteps[0].content[1].code;

    expect(codeSnippet).toContain('SentrySdk.Init');
    expect(codeSnippet).toContain(mockParams.dsn.public);
    expect(codeSnippet).toContain('Metrics.EmitCounter');
  });
});
