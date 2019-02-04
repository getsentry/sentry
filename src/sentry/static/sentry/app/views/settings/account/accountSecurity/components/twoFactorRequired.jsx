import React from 'react';
import styled from 'react-emotion';

import PropTypes from 'prop-types';
import {capitalize} from 'lodash';
import {t} from 'app/locale';
import Alert from 'app/components/alert';
import AsyncComponent from 'app/components/asyncComponent';
import space from 'app/styles/space';

const StyledAlert = styled(Alert)`
  margin: ${space(3)} 0;
`;

class TwoFactorRequired extends AsyncComponent {
  static propTypes = {
    orgsRequire2fa: PropTypes.arrayOf(PropTypes.object).isRequired,
  };

  getEndpoints() {
    return [];
  }

  renderBody() {
    const {orgsRequire2fa} = this.props;
    if (!orgsRequire2fa.length) {
      return null;
    }

    // singular vs plural message
    const plural = orgsRequire2fa.length > 1;
    const require = plural ? t('organizations require') : t('organization requires');
    const organizations = plural ? t('these organizations') : t('this organization');

    const names = orgsRequire2fa.map(({name}) => capitalize(name));
    const organizationNames = [names.slice(0, -1).join(', '), names.slice(-1)[0]].join(
      plural ? ' and ' : ''
    );

    return (
      <StyledAlert className="require-2fa" type="error" icon="icon-circle-exclamation">
        {t(
          'The %s %s all members to enable two-factor authentication.' +
            ' You need to enable two-factor authentication to access projects under %s.',
          organizationNames,
          require,
          organizations
        )}
      </StyledAlert>
    );
  }
}

export default TwoFactorRequired;
