import {Fragment} from 'react';
import {Link} from 'react-router-dom';

import {Alert} from '@sentry/scraps/alert';

import {t, tct} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';

import type {PathMappingWarning} from './warnings';

interface PathMappingWarningAlertProps {
  warning: PathMappingWarning | null | undefined;
  // Required when warning.type === 'codeOwner' to build the ownership link.
  projectSlug?: string;
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
  const organization = useOrganization();

  if (warning?.type === 'codeOwner') {
    const ownershipUrl = `/settings/${organization.slug}/projects/${projectSlug}/ownership/`;
    return (
      <Alert variant="warning" showIcon>
        {tct(
          'This mapping is linked to a [link:Code Owners] file. Remove the Code Owners connection before editing these paths or deleting this mapping.',
          {link: <Link to={ownershipUrl} />}
        )}
      </Alert>
    );
  }

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
            stackRoot: displayRoot(warning.stackRoot, t('stack trace prefix')),
            sourceRoot: displayRoot(warning.sourceRoot, t('repository prefix')),
          }
        )}
      </Alert>
    );
  }

  return null;
}
