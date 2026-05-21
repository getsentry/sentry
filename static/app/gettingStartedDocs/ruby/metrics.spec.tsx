const {metrics: rubyMetrics} = jest.requireActual(
  'sentry/gettingStartedDocs/ruby/metrics'
);

describe('metrics', () => {
  const mockParams = {
    dsn: {
      public: 'https://test@example.com/123',
    },
  };

  it('generates metrics onboarding config', () => {
    const config = rubyMetrics({docsPlatform: 'ruby'});

    const installSteps = config.install();
    expect(installSteps).toHaveLength(1);
    expect(installSteps[0].type).toBe('install');

    const verifySteps = config.verify(mockParams);
    expect(verifySteps).toHaveLength(1);
    expect(verifySteps[0].type).toBe('verify');

    const codeSnippet = verifySteps[0].content[1].code;
    expect(codeSnippet).toContain('Sentry.init');
    expect(codeSnippet).toContain(mockParams.dsn.public);
    expect(codeSnippet).toContain('Sentry.metrics.count');
    expect(codeSnippet).toContain('Sentry.metrics.gauge');
    expect(codeSnippet).toContain('Sentry.metrics.distribution');
  });
});
