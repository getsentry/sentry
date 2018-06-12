import React from 'react';
import styled from 'react-emotion';

import {capitalize} from 'lodash';
import {t} from 'app/locale';
import Alert from 'app/components/alert';
import AsyncComponent from 'app/components/asyncComponent';
import space from 'app/styles/space';

let StyledAlert = styled(Alert)`
  margin: ${space(3)} 0;
`;

class TwoFactorRequired extends AsyncComponent {
  getEndpoints() {
    return [['organizations', '/organizations/']];
  }

  renderBody() {
    let orgsRequire2fa = this.state.organizations
      .filter(org => org.require2FA)
      .map(({name}) => capitalize(name));

    if (!orgsRequire2fa.length) {
      return null;
    }

    // singular vs plural message
    let plural = orgsRequire2fa.length > 1;

    let organizationNames = [
      orgsRequire2fa.slice(0, -1).join(', '),
      orgsRequire2fa.slice(-1)[0],
    ].join(plural ? ' and ' : '');

    let require = plural ? t('organizations require') : t('organization requires');
    let organizations = plural ? t('these organizations') : t('this organization');

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
