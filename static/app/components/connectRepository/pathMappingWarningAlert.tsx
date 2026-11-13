import {Alert} from '@sentry/scraps/alert';

import {t, tct} from 'sentry/locale';

import {CodeOwnerMessage} from './codeOwnerMessage';
import type {PathMappingWarning} from './warnings';

interface PathMappingWarningAlertProps {
  projectSlug?: string;
  warning?: PathMappingWarning;
}

export function PathMappingWarningAlert({
  warning,
  projectSlug,
}: PathMappingWarningAlertProps) {
  if (warning?.type === 'codeOwner') {
    return (
      <Alert variant="warning" showIcon={false}>
        <CodeOwnerMessage projectSlug={projectSlug} />
      </Alert>
    );
  }

  if (warning?.type === 'exactInForm') {
    return (
      <Alert variant="warning" showIcon={false}>
        {t('Duplicate code mapping')}
      </Alert>
    );
  }

  if (warning?.type === 'exactAcrossRepos') {
    return (
      <Alert variant="warning" showIcon={false}>
        {tct('Already mapped in [repoName]. Change the paths to save.', {
          repoName: <strong>{warning.repoName}</strong>,
        })}
      </Alert>
    );
  }

  return null;
}
