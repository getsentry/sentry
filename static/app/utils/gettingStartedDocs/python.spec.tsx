import {getPythonInstallCodeBlock} from 'sentry/utils/gettingStartedDocs/python';

// Only import and test functions that don't have circular dependencies
const {getPythonLogsOnboarding} = jest.requireActual(
  'sentry/utils/gettingStartedDocs/python'
);

describe('getPythonInstallCodeBlock', () => {
  it('generates install commands with default parameters', () => {
    const result = getPythonInstallCodeBlock({
      packageName: 'sentry-sdk',
    });

    expect(result).toEqual({
      type: 'code',
      tabs: [
        {
          label: 'pip',
          language: 'bash',
          code: `pip install "sentry-sdk"`,
        },
        {
          label: 'uv',
          language: 'bash',
          code: `uv add "sentry-sdk"`,
        },
        {
          label: 'poetry',
          language: 'bash',
          code: `poetry add "sentry-sdk"`,
        },
      ],
    });
  });

  it('generates pip install command with minimum version and extras', () => {
    const result = getPythonInstallCodeBlock({
      packageName: 'sentry-sdk[with-extras]',
      minimumVersion: '2.3.4',
    });
    expect(result).toEqual({
      type: 'code',
      tabs: [
        {
          label: 'pip',
          language: 'bash',
          code: `pip install --upgrade "sentry-sdk[with-extras]>=2.3.4"`,
        },
        {
          label: 'uv',
          language: 'bash',
          code: `uv add --upgrade "sentry-sdk[with-extras]>=2.3.4"`,
        },
        {
          label: 'poetry',
          language: 'bash',
          code: `poetry add "sentry-sdk[with-extras]>=2.3.4"`,
        },
      ],
    });
  });
});

describe('getPythonLogsOnboarding', () => {
  const mockParams = {
    dsn: {
      public: 'https://test@example.com/123',
    },
  };

  it('generates logs onboarding config with default parameters', () => {
    const result = getPythonLogsOnboarding();

    // Test install step
    const installSteps = result.install();
    expect(installSteps).toHaveLength(1);
    expect(installSteps[0].type).toBe('install');
    expect(installSteps[0].content).toHaveLength(2);

    // Test configure step
    const configureSteps = result.configure(mockParams);
    expect(configureSteps).toHaveLength(1);
    expect(configureSteps[0].type).toBe('configure');
    expect(configureSteps[0].content[1].code).toContain('enable_logs=True');
    expect(configureSteps[0].content[1].code).toContain(mockParams.dsn.public);

    // Test verify step
    const verifySteps = result.verify({isLogsSelected: true});
    expect(verifySteps).toHaveLength(1);
    expect(verifySteps[0].type).toBe('verify');
    expect(verifySteps[0].content).toHaveLength(1);
    expect(verifySteps[0].content[0].type).toBe('conditional');
    const conditionalContent = verifySteps[0].content[0].content;
    expect(conditionalContent[1].code).toContain('sentry_sdk.logger.info');
    expect(conditionalContent[3].code).toContain('import logging');
  });

  it('generates logs onboarding config with custom parameters', () => {
    const result = getPythonLogsOnboarding({
      packageName: 'custom-sentry-sdk',
      minimumVersion: '3.0.0',
    });

    const installSteps = result.install();
    expect(installSteps[0].content).toHaveLength(2);
  });
});
