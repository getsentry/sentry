import type {ReactNode} from 'react';

import {Alert, type AlertProps} from '@sentry/scraps/alert';

import Access from 'sentry/components/acl/access';
import {t} from 'sentry/locale';
import type {Scope} from 'sentry/types/core';

interface OrganizationPermissionAlertProps extends Omit<AlertProps, 'variant'> {
  access?: Scope[];
  message?: ReactNode;
}

export function OrganizationPermissionAlert({
  access = ['org:write'],
  message = t(
    'These settings can only be edited by users with the organization owner or manager role.'
  ),
  ...props
}: OrganizationPermissionAlertProps) {
  return (
    <Access access={access}>
      {({hasAccess}) =>
        !hasAccess && (
          <Alert.Container>
            <Alert data-test-id="org-permission-alert" variant="warning" {...props}>
              {message}
            </Alert>
          </Alert.Container>
        )
      }
    </Access>
  );
}
