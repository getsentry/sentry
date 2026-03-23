import {type ContentBlock} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {tct} from 'sentry/locale';

function getPythonInstallSnippet({
  packageName,
  minimumVersion,
  additionalPackage,
}: {
  packageName: string;
  additionalPackage?: string;
  minimumVersion?: string;
}) {
  // We are using consistent double quotes here for all package managers after aligning with the Python SDK team.
  // Not using quotes may lead to some shells interpreting the square brackets, and using double quotes over single quotes is a convention.
  const versionedPackage = minimumVersion
    ? `"${packageName}>=${minimumVersion}"`
    : `"${packageName}"`;

  const upgradeFlag = minimumVersion ? '--upgrade ' : '';
  const additionalPkg = additionalPackage ? ` "${additionalPackage}"` : '';

  const packageManagerCommands = {
    uv: `uv add ${upgradeFlag}${versionedPackage}${additionalPkg}`,
    pip: `pip install ${upgradeFlag}${versionedPackage}${additionalPkg}`,
    poetry: `poetry add ${versionedPackage}${additionalPkg}`,
  };

  return packageManagerCommands;
}

export function getPythonInstallCodeBlock({
  packageName = 'sentry-sdk',
  minimumVersion,
  additionalPackage,
}: {
  additionalPackage?: string;
  minimumVersion?: string;
  packageName?: string;
} = {}): ContentBlock {
  const packageManagerCommands = getPythonInstallSnippet({
    packageName,
    minimumVersion,
    additionalPackage,
  });
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
