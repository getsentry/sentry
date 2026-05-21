const {metrics: elixirMetrics} = jest.requireActual(
  'sentry/gettingStartedDocs/elixir/metrics'
);

describe('metrics', () => {
  const mockParams = {
    dsn: {
      public: 'https://test@example.com/123',
    },
  };

  it('generates metrics onboarding config', () => {
    const installSteps = elixirMetrics.install();
    expect(installSteps).toHaveLength(1);
    expect(installSteps[0].type).toBe('install');

    const verifySteps = elixirMetrics.verify(mockParams);
    expect(verifySteps).toHaveLength(1);
    expect(verifySteps[0].type).toBe('verify');

    const codeSnippet = verifySteps[0].content[1].code;
    expect(codeSnippet).toContain('Sentry.init');
    expect(codeSnippet).toContain(mockParams.dsn.public);
    expect(codeSnippet).toContain('Sentry.Metrics.count');
    expect(codeSnippet).toContain('Sentry.Metrics.gauge');
    expect(codeSnippet).toContain('Sentry.Metrics.distribution');
  });
});
