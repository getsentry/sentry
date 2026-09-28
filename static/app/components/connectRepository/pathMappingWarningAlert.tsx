import {Fragment} from 'react';

import {Alert} from '@sentry/scraps/alert';

import {t, tct} from 'sentry/locale';

import {normalizeRoot} from './normalization';
import type {PathMappingWarning} from './warnings';

interface PathMappingWarningAlertProps {
  stackRoot: string;
  warning: PathMappingWarning | null | undefined;
}

function displayStackRoot(root: string) {
  if (root) {
    return <strong>{root}</strong>;
  }
  return (
    <Fragment>
      <strong>{t('empty')}</strong> {t('stack trace prefix')}
    </Fragment>
  );
}

function displaySourceRoot(root: string) {
  if (root) {
    return <strong>{root}</strong>;
  }
  return (
    <Fragment>
      <strong>{t('empty')}</strong> {t('repository prefix')}
    </Fragment>
  );
}

function displayRepo(repoName: string) {
  return <strong>{repoName}</strong>;
}

// A path under this rule that the longer rule does not match.
function uncoveredExample(currentRoot: string, moreSpecific: string) {
  const candidate = `${currentRoot}lib/`;
  return candidate.startsWith(moreSpecific) ? `${currentRoot}other/` : candidate;
}

export function PathMappingWarningAlert({
  stackRoot,
  warning,
}: PathMappingWarningAlertProps) {
  if (warning?.type === 'catchAll') {
    return (
      <Alert variant="info" showIcon>
        {t(
          'This mapping matches every path because the stack trace prefix is empty. Add a specific path if you only want it to apply to some files.'
        )}
      </Alert>
    );
  }

  if (warning?.type === 'exact') {
    return (
      <Alert variant="warning" showIcon>
        {tct(
          '[stackRoot] is already mapped to [sourceRoot]. Only one can be used for matching.',
          {
            stackRoot: displayStackRoot(warning.stackRoot),
            sourceRoot: displaySourceRoot(warning.sourceRoot),
          }
        )}
      </Alert>
    );
  }

  if (warning?.type === 'exactExisting') {
    return (
      <Alert variant="warning" showIcon>
        {tct(
          '[stackRoot] is already mapped to [sourceRoot] in the [repo] repository. Only one can be used for matching.',
          {
            stackRoot: displayStackRoot(warning.stackRoot),
            sourceRoot: displaySourceRoot(warning.sourceRoot),
            repo: displayRepo(warning.repoName),
          }
        )}
      </Alert>
    );
  }

  if (warning?.type === 'overlap' || warning?.type === 'overlapExisting') {
    const currentRoot = displayStackRoot(normalizeRoot(stackRoot));
    const moreSpecific = displayStackRoot(warning.stackRoot);
    const example = uncoveredExample(normalizeRoot(stackRoot), warning.stackRoot);
    const message =
      warning.type === 'overlapExisting'
        ? tct(
            '[moreSpecific] in the [repo] repository is a more specific rule than this mapping ([currentRoot]), so paths under [moreSpecific] use that rule first. This mapping still applies to other paths under [currentRoot], such as [example].',
            {
              moreSpecific,
              repo: displayRepo(warning.repoName),
              currentRoot,
              example: <strong>{example}</strong>,
            }
          )
        : tct(
            '[moreSpecific] is a more specific rule than this mapping ([currentRoot]), so paths under [moreSpecific] use that rule first. This mapping still applies to other paths under [currentRoot], such as [example].',
            {moreSpecific, currentRoot, example: <strong>{example}</strong>}
          );

    return (
      <Alert variant="warning" showIcon>
        {message}
      </Alert>
    );
  }

  return null;
}
