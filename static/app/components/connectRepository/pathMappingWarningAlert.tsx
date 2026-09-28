import {Alert} from '@sentry/scraps/alert';

import {t, tct} from 'sentry/locale';

import {normalizeRoot} from './normalization';
import type {PathMappingWarning} from './warnings';

interface PathMappingWarningAlertProps {
  stackRoot: string;
  warning: PathMappingWarning | null | undefined;
}

export function PathMappingWarningAlert({
  stackRoot,
  warning,
}: PathMappingWarningAlertProps) {
  if (warning?.type === 'catchAll') {
    return (
      <Alert variant="info" showIcon>
        {t(
          'A mapping that matches every path already exists for this project and repository, so this rule needs a specific path to match.'
        )}
      </Alert>
    );
  }

  if (warning?.type === 'overlap') {
    const isExactDuplicate = normalizeRoot(stackRoot) === warning.stackRoot;
    return (
      <Alert variant="warning" showIcon>
        {isExactDuplicate
          ? tct(
              '[stackRoot] is already mapped to [sourceRoot]. Only the first match applies, so this one won\u2019t take effect.',
              {
                stackRoot: warning.stackRoot || t('empty'),
                sourceRoot: warning.sourceRoot || t('empty'),
              }
            )
          : tct(
              '[stackRoot] is more specific and matches first. This mapping still applies to paths that [stackRoot] does not cover.',
              {stackRoot: warning.stackRoot || t('empty')}
            )}
      </Alert>
    );
  }

  return null;
}
