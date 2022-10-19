import {ReactNode} from 'react';

import Access from 'sentry/components/acl/access';
import Alert from 'sentry/components/alert';
import {t} from 'sentry/locale';

type Props = React.ComponentPropsWithoutRef<typeof Alert> &
  Pick<React.ComponentProps<typeof Access>, 'access'> & {
    message?: ReactNode;
  };

const PermissionAlert = ({
  access = ['org:write'],
  message = t(
    'These settings can only be edited by users with the organization owner or manager role.'
  ),
  ...props
}: Props) => (
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

export default PermissionAlert;
