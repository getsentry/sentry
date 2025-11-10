import {getPythonInstallCodeBlock} from './utils';

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
