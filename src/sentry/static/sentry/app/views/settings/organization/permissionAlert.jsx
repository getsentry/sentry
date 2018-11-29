import PropTypes from 'prop-types';
import React from 'react';

import {t} from 'app/locale';
import Access from 'app/components/acl/access';
import Alert from 'app/components/alert';

const PermissionAlert = ({access, ...props}) => (
  <Access access={access}>
    {({hasAccess}) =>
      !hasAccess && (
        <Alert type="warning" icon="icon-warning-sm" {...props}>
          {t(
            'These settings can only be edited by users with the owner or manager role.'
          )}
        </Alert>
      )}
  </Access>
);

PermissionAlert.propTypes = {
  access: PropTypes.arrayOf(PropTypes.string),
};

PermissionAlert.defaultProps = {
  access: ['org:write'],
};

export default PermissionAlert;
