import * as React from 'react';

import Access from 'app/components/acl/access';
import Alert from 'app/components/alert';
import {IconWarning} from 'app/icons';
import {t} from 'app/locale';

type Props = React.ComponentPropsWithoutRef<typeof Alert> &
  Pick<React.ComponentProps<typeof Access>, 'access'>;

const PermissionAlert = ({access = ['project:write'], ...props}: Props) => (
  <Access access={access}>
    {({hasAccess}) =>
      !hasAccess && (
        <Alert type="warning" icon={<IconWarning size="xs" />} {...props}>
          {t(
            'These settings can only be edited by users with the organization owner, manager, or admin role.'
          )}
        </Alert>
      )
    }
  </Access>
);

export default PermissionAlert;
