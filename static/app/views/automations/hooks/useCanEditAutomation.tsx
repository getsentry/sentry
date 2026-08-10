import type {ReactNode} from 'react';

import {Link} from '@sentry/scraps/link';

import {hasEveryAccess} from 'sentry/components/acl/access';
import {tct} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';

export function useCanEditAutomation(): boolean {
  const organization = useOrganization();
  // TODO(Leander): Workflows connected to the all-projects detector require elevated permissions
  // (org:write) but at the moment, not every callsite for this hook has the context to determine
  // whether that applies. The backend still gates the mutations correctly, but this means some
  // buttons don't appear disabled when they should.
  return hasEveryAccess(['alerts:write'], {organization});
}

function AlertsMemberWriteSettingsLink({children}: {children?: ReactNode}) {
  const organization = useOrganization();

  return (
    <Link
      to={{
        hash: 'alertsMemberWrite',
        pathname: `/settings/${organization.slug}/`,
      }}
    >
      {children}
    </Link>
  );
}

export function getNoAlertWritePermissionTooltip() {
  return tct(
    'You do not have permission to create or edit alerts. Ask your organization owner or manager to [settingsLink:enable alert access] for you.',
    {settingsLink: <AlertsMemberWriteSettingsLink />}
  );
}
