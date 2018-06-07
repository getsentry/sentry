import React from 'react';
import styled from 'react-emotion';

import {capitalize} from 'lodash';
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
    let orgsRequire2FA = this.state.organizations
      .filter(org => org.require2FA === true)
      .map(({name}) => {
        return capitalize(name);
      });
    let multipleOrgs = orgsRequire2FA.length > 1;
    let formattedNames = orgsRequire2FA.join(', ').replace(/,(?!.*,)/gim, ' and');

    if (!orgsRequire2FA.length) {
      return null;
    }

    return (
      <div>
        {multipleOrgs ? (
          <StyledAlert type="error" icon="icon-circle-exclamation">
            {`The ${formattedNames} organizations require all members to enable
              two-factor authentication. You need to enable two-factor
              authentication to access projects under these organizations.`}
          </StyledAlert>
        ) : (
          <StyledAlert type="error" icon="icon-circle-exclamation">
            {`The ${formattedNames} organization requires all members to enable
              two-factor authentication. You need to enable two-factor
              authentication to access projects under this organization.`}
          </StyledAlert>
        )}
      </div>
    );
  }
}

export default TwoFactorRequired;
