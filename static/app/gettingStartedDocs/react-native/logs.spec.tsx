const {logs} = jest.requireActual('sentry/gettingStartedDocs/react-native/logs');

describe('logs', () => {
  const mockParams = {
    dsn: {
      public: 'https://test@example.com/123',
    },
  };

  it('generates logs onboarding config', () => {
    const result = logs;

    // Test install step
    const installSteps = result.install(mockParams);
    expect(installSteps).toHaveLength(1);
    expect(installSteps[0].type).toBe('install');
    expect(installSteps[0].content).toHaveLength(2);

    // Test configure step
    const configureSteps = result.configure(mockParams);
    expect(configureSteps).toHaveLength(1);
    expect(configureSteps[0].type).toBe('configure');
    expect(configureSteps[0].content).toHaveLength(2);
    const codeSnippet = configureSteps[0].content[1].code;
    expect(codeSnippet).toContain('Sentry.init');
    expect(codeSnippet).toContain(mockParams.dsn.public);
    expect(codeSnippet).toContain('enableLogs: true');

    // Test verify step
    const verifySteps = result.verify();
    expect(verifySteps).toHaveLength(1);
    expect(verifySteps[0].type).toBe('verify');
    expect(verifySteps[0].content).toHaveLength(3);
    const verifyCodeSnippet = verifySteps[0].content[1].code;
    expect(verifyCodeSnippet).toContain('Sentry.logger.info');
    expect(verifyCodeSnippet).toContain('Sentry.logger.warn');
    expect(verifyCodeSnippet).toContain('Sentry.logger.error');
  });
});
