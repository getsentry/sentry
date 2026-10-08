import {Fragment} from 'react';

import {Alert} from '@sentry/scraps/alert';

import {t, tct} from 'sentry/locale';

import {CodeOwnerMessage} from './codeOwnerMessage';
import type {PathMappingWarning} from './warnings';

interface PathMappingWarningAlertProps {
  projectSlug?: string;
  warning?: PathMappingWarning;
}

function displayRoot(root: string, emptyLabel: string) {
  if (root) {
    return <strong>{root}</strong>;
  }
  return (
    <Fragment>
      <strong>{t('empty')}</strong> {emptyLabel}
    </Fragment>
  );
}

export function PathMappingWarningAlert({
  warning,
  projectSlug,
}: PathMappingWarningAlertProps) {
  if (warning?.type === 'codeOwner') {
    return (
      <Alert variant="warning" showIcon>
        <CodeOwnerMessage projectSlug={projectSlug} />
      </Alert>
    );
  }

  if (warning?.type === 'catchAll') {
    const {stackRoot, sourceRoot} = warning;
    const bothEmpty = stackRoot === '' && sourceRoot === '';
    const stackEmpty = stackRoot === '' && sourceRoot !== '';

    if (bothEmpty) {
      return (
        <Alert variant="muted" showIcon>
          {t(
            'Both prefixes are empty, so Sentry will look for each file at the same path in your repo.'
          )}
        </Alert>
      );
    }

    if (stackEmpty) {
      return (
        <Alert variant="muted" showIcon>
          {tct(
            'The stack trace prefix is empty, so this mapping matches every file. Sentry will look for each file under [sourceRoot] in your repo.',
            {sourceRoot: <strong>{sourceRoot}</strong>}
          )}
        </Alert>
      );
    }

    return (
      <Alert variant="muted" showIcon>
        {tct(
          'The repository prefix is empty, so Sentry removes [stackRoot] from the path and looks for the rest at the root of your repo.',
          {stackRoot: <strong>{stackRoot}</strong>}
        )}
      </Alert>
    );
  }

  if (warning?.type === 'exactInForm') {
    return (
      <Alert variant="warning" showIcon>
        {tct(
          '[stackRoot] is already mapped to [sourceRoot] in this form. Remove one since only one of them is required for path matching.',
          {
            stackRoot: displayRoot(warning.stackRoot, t('stack trace prefix')),
            sourceRoot: displayRoot(warning.sourceRoot, t('repository prefix')),
          }
        )}
      </Alert>
    );
  }

  if (warning?.type === 'exactAcrossRepos') {
    return (
      <Alert variant="warning" showIcon>
        {tct(
          '[stackRoot] is already mapped to [sourceRoot] in the connection to [repoName] repository. Only one can be used for matching.',
          {
            stackRoot: displayRoot(warning.stackRoot, t('stack trace prefix')),
            sourceRoot: displayRoot(warning.sourceRoot, t('repository prefix')),
            repoName: <strong>{warning.repoName}</strong>,
          }
        )}
      </Alert>
    );
  }

  return null;
}
