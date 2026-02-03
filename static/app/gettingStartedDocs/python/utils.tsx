import {type ContentBlock} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {tct} from 'sentry/locale';

function getPythonInstallSnippet({
  packageName,
  minimumVersion,
}: {
  packageName: string;
  minimumVersion?: string;
}) {
  // We are using consistent double quotes here for all package managers after aligning with the Python SDK team.
  // Not using quotes may lead to some shells interpreting the square brackets, and using double quotes over single quotes is a convention.
  const versionedPackage = minimumVersion
    ? `"${packageName}>=${minimumVersion}"`
    : `"${packageName}"`;

  const upgradeFlag = minimumVersion ? '--upgrade ' : '';

  const packageManagerCommands = {
    uv: `uv add ${upgradeFlag}${versionedPackage}`,
    pip: `pip install ${upgradeFlag}${versionedPackage}`,
    poetry: `poetry add ${versionedPackage}`,
  };

  return packageManagerCommands;
}

export function getPythonInstallCodeBlock({
  packageName = 'sentry-sdk',
  minimumVersion,
}: {
  minimumVersion?: string;
  packageName?: string;
} = {}): ContentBlock {
  const packageManagerCommands = getPythonInstallSnippet({packageName, minimumVersion});
  return {
    type: 'code',
    tabs: [
      {
        label: 'pip',
        language: 'bash',
        code: packageManagerCommands.pip,
      },
      {
        label: 'uv',
        language: 'bash',
        code: packageManagerCommands.uv,
      },
      {
        label: 'poetry',
        language: 'bash',
        code: packageManagerCommands.poetry,
      },
    ],
  };
}

export function getPythonAiocontextvarsCodeBlocks({
  description,
}: {
  description?: React.ReactNode;
} = {}): ContentBlock[] {
  const defaultDescription = tct(
    "If you're on Python 3.6, you also need the [code:aiocontextvars] package:",
    {
      code: <code />,
    }
  );

  return [
    {
      type: 'text',
      text: description ?? defaultDescription,
    },
    getPythonInstallCodeBlock({
      packageName: 'aiocontextvars',
    }),
  ];
}
