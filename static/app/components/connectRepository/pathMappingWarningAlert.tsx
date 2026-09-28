import {Fragment} from 'react';

import {Alert} from '@sentry/scraps/alert';

import {t, tct} from 'sentry/locale';

import type {PathMappingWarning} from './warnings';

interface PathMappingWarningAlertProps {
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

export function PathMappingWarningAlert({warning}: PathMappingWarningAlertProps) {
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

  return null;
}
