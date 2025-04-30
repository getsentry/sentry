// Mock the modules that cause circular dependencies
jest.mock('sentry/utils/gettingStartedDocs/python', () => {
  const original = jest.requireActual('sentry/utils/gettingStartedDocs/python');
  return {
    ...original,
    // Mock any functions causing circular dependencies
    getPythonProfilingOnboarding: jest.fn(),
  };
});

import {getPythonInstallSnippet} from 'sentry/utils/gettingStartedDocs/python';

describe('getPythonInstallSnippet', () => {
  it('generates install commands with default parameters', () => {
    const result = getPythonInstallSnippet({
      packageName: 'sentry-sdk',
    });

    expect(result.pip).toBe(`pip install "sentry-sdk"`);
    expect(result.uv).toBe(`uv add "sentry-sdk"`);
    expect(result.poetry).toBe(`poetry add "sentry-sdk"`);
  });

  it('generates pip install command with minimum version and extras', () => {
    const result = getPythonInstallSnippet({
      packageName: 'sentry-sdk[with-extras]',
      minimumVersion: '2.3.4',
    });
    expect(result.pip).toBe(`pip install --upgrade "sentry-sdk[with-extras]>=2.3.4"`);
    expect(result.uv).toBe(`uv add --upgrade "sentry-sdk[with-extras]>=2.3.4"`);
    expect(result.poetry).toBe(`poetry add "sentry-sdk[with-extras]>=2.3.4"`);
  });
});
