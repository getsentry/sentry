const {metrics: rustMetrics} = jest.requireActual(
  'sentry/gettingStartedDocs/rust/metrics'
);

describe('metrics', () => {
  const mockParams = {
    dsn: {
      public: 'https://test@example.com/123',
    },
  };

  it('generates metrics onboarding config', () => {
    const installSteps = rustMetrics.install();
    expect(installSteps).toHaveLength(1);
    expect(installSteps[0].type).toBe('install');

    const verifySteps = rustMetrics.verify(mockParams);
    expect(verifySteps).toHaveLength(1);
    expect(verifySteps[0].type).toBe('verify');

    const codeSnippet = verifySteps[0].content[1].code;
    expect(codeSnippet).toContain('sentry::init');
    expect(codeSnippet).toContain(mockParams.dsn.public);
    expect(codeSnippet).toContain('metrics::counter');
    expect(codeSnippet).toContain('metrics::gauge');
    expect(codeSnippet).toContain('metrics::distribution');
  });
});
