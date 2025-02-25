import type {ReactNode} from 'react';

import Access from 'sentry/components/acl/access';
import {Alert, type AlertProps} from 'sentry/components/core/alert/alert';
import {t} from 'sentry/locale';
import type {Scope} from 'sentry/types/core';

export interface OrganizationPermissionAlertProps extends Omit<AlertProps, 'type'> {
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
            <Alert data-test-id="org-permission-alert" type="warning" showIcon {...props}>
              {message}
            </Alert>
          </Alert.Container>
        )
      }
    </Access>
  );
}
