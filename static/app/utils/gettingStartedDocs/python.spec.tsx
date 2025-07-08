// Mock the modules that cause circular dependencies
jest.mock('sentry/utils/gettingStartedDocs/python', () => {
  const original = jest.requireActual('sentry/utils/gettingStartedDocs/python');
  return {
    ...original,
    // Mock any functions causing circular dependencies
    getPythonProfilingOnboarding: jest.fn(),
  };
});

import {getPythonInstallConfig} from 'sentry/utils/gettingStartedDocs/python';

describe('getPythonInstallConfig', () => {
  it('generates install commands with default parameters', () => {
    const result = getPythonInstallConfig({
      packageName: 'sentry-sdk',
      description: 'Install the Sentry SDK',
    });

    expect(result).toEqual([
      {
        description: 'Install the Sentry SDK',
        language: 'bash',
        code: [
          {
            label: 'pip',
            value: 'pip',
            language: 'bash',
            code: `pip install "sentry-sdk"`,
          },
          {
            label: 'uv',
            value: 'uv',
            language: 'bash',
            code: `uv add "sentry-sdk"`,
          },
          {
            label: 'poetry',
            value: 'poetry',
            language: 'bash',
            code: `poetry add "sentry-sdk"`,
          },
        ],
      },
    ]);
  });

  it('generates pip install command with minimum version and extras', () => {
    const result = getPythonInstallConfig({
      packageName: 'sentry-sdk[with-extras]',
      description: 'Install the Sentry SDK',
      minimumVersion: '2.3.4',
    });
    expect(result).toEqual([
      {
        description: 'Install the Sentry SDK',
        language: 'bash',
        code: [
          {
            label: 'pip',
            value: 'pip',
            language: 'bash',
            code: `pip install --upgrade "sentry-sdk[with-extras]>=2.3.4"`,
          },
          {
            label: 'uv',
            value: 'uv',
            language: 'bash',
            code: `uv add --upgrade "sentry-sdk[with-extras]>=2.3.4"`,
          },
          {
            label: 'poetry',
            value: 'poetry',
            language: 'bash',
            code: `poetry add "sentry-sdk[with-extras]>=2.3.4"`,
          },
        ],
      },
    ]);
  });
});
