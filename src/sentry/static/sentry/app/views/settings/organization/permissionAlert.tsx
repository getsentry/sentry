import PropTypes from 'prop-types';
import * as React from 'react';

import {t} from 'app/locale';
import Access from 'app/components/acl/access';
import Alert from 'app/components/alert';
import {IconWarning} from 'app/icons';

type Props = React.ComponentPropsWithoutRef<typeof Alert> &
  Pick<React.ComponentProps<typeof Access>, 'access'>;

const PermissionAlert = ({access = ['org:write'], ...props}: Props) => (
  <Access access={access}>
    {({hasAccess}) =>
      !hasAccess && (
        <Alert type="warning" icon={<IconWarning size="sm" />} {...props}>
          {t(
            'These settings can only be edited by users with the organization owner or manager role.'
          )}
        </Alert>
      )
    }
  </Access>
);

PermissionAlert.propTypes = {
  access: PropTypes.arrayOf(PropTypes.string),
};

export default PermissionAlert;
