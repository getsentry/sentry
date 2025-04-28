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
  it('generates pip install command with default parameters', () => {
    const result = getPythonInstallSnippet({
      packageName: 'sentry-sdk',
    });

    expect(result).toBe(`pip install 'sentry-sdk'`);
  });

  it('generates pip install command with minimum version and extras', () => {
    const result = getPythonInstallSnippet({
      packageName: 'sentry-sdk[with-extras]',
      minimumVersion: '1.2.3',
    });
    expect(result).toBe(`pip install --upgrade 'sentry-sdk[with-extras]>=1.2.3'`);
  });

  it('generates uv install command with default parameters', () => {
    const result = getPythonInstallSnippet({
      packageName: 'sentry-sdk',
      packageManager: 'uv',
    });

    expect(result).toBe(`uv add 'sentry-sdk'`);
  });

  it('generates uv install command with minimum version and extras', () => {
    const result = getPythonInstallSnippet({
      packageName: 'sentry-sdk[with-extras]',
      packageManager: 'uv',
      minimumVersion: '2.3.4',
    });

    expect(result).toBe(`uv add --upgrade 'sentry-sdk[with-extras]>=2.3.4'`);
  });

  it('generates poetry install command with default parameters', () => {
    const result = getPythonInstallSnippet({
      packageName: 'sentry-sdk',
      packageManager: 'poetry',
    });

    expect(result).toBe(`poetry add 'sentry-sdk'`);
  });

  it('generates poetry install command with minimum version and extras', () => {
    const result = getPythonInstallSnippet({
      packageName: 'sentry-sdk[with-extras]',
      packageManager: 'poetry',
      minimumVersion: '2.3.4',
    });

    expect(result).toBe(`poetry add 'sentry-sdk[with-extras]>=2.3.4'`);
  });
});
