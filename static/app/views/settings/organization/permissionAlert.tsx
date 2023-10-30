import {ReactNode} from 'react';

import Access from 'sentry/components/acl/access';
import {Alert} from 'sentry/components/alert';
import {t} from 'sentry/locale';
import {Scope} from 'sentry/types';

type Props = React.ComponentPropsWithoutRef<typeof Alert> & {
  access?: Scope[];
  message?: ReactNode;
};

function PermissionAlert({
  access = ['org:write'],
  message = t(
    'These settings can only be edited by users with the organization owner or manager role.'
  ),
  ...props
}: Props) {
  return (
    <Access access={access}>
      {({hasAccess}) =>
        !hasAccess && (
          <Alert data-test-id="org-permission-alert" type="warning" showIcon {...props}>
            {message}
          </Alert>
        )
      }
    </Access>
  );
}

export default PermissionAlert;
