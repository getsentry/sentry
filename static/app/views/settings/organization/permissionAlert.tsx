import type {ReactNode} from 'react';

import Access from 'sentry/components/acl/access';
import {Alert, type AlertProps} from 'sentry/components/alert';
import {t} from 'sentry/locale';
import type {Scope} from 'sentry/types/core';

interface PermissionAlertProps extends Omit<AlertProps, 'type'> {
  access?: Scope[];
  message?: ReactNode;
}

/**
 * @deprecated Use `OrganizationPermissionAlert` instead.
 */
function PermissionAlert({
  access = ['org:write'],
  message = t(
    'These settings can only be edited by users with the organization owner or manager role.'
  ),
  ...props
}: PermissionAlertProps) {
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

export default PermissionAlert;
