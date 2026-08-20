import type {ReactNode} from 'react';

import {Alert, type AlertProps} from '@sentry/scraps/alert';
import {Link} from '@sentry/scraps/link';

import {Access} from 'sentry/components/acl/access';
import {tct} from 'sentry/locale';
import type {Scope} from 'sentry/types/core';
import {useOrganization} from 'sentry/utils/useOrganization';

interface OrganizationPermissionAlertProps extends Omit<AlertProps, 'variant'> {
  access?: Scope[];
  message?: ReactNode;
}

export function OrganizationPermissionAlert({
  access = ['org:write'],
  message,
  ...props
}: OrganizationPermissionAlertProps) {
  const organization = useOrganization();

  return (
    <Access access={access}>
      {({hasAccess}) =>
        !hasAccess && (
          <Alert.Container>
            <Alert data-test-id="org-permission-alert" variant="warning" {...props}>
              {message ??
                tct(
                  'These settings can only be edited by users with the organization owner or manager role. [link:View your organization members].',
                  {link: <Link to={`/settings/${organization.slug}/members/`} />}
                )}
            </Alert>
          </Alert.Container>
        )
      }
    </Access>
  );
}
