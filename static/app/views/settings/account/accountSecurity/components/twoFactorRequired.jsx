import React from 'react';
import styled from 'react-emotion';

import {tct} from 'app/locale';
import Alert from 'app/components/alert';
import AsyncComponent from 'app/components/asyncComponent';
import Cookies from 'js-cookie';
import ExternalLink from 'app/components/externalLink';
import space from 'app/styles/space';

const PENDING_INVITE = 'pending-invite';

class TwoFactorRequired extends AsyncComponent {
  getEndpoints() {
    return [];
  }

  renderBody() {
    const pendingInvite = Cookies.get(PENDING_INVITE);

    if (!pendingInvite) {
      return null;
    }

    return (
      <StyledAlert data-test-id="require-2fa" type="error" icon="icon-circle-exclamation">
        {tct(
          'You have been invited to an organization that requires [link:two-factor authentication].' +
            ' Setup two-factor authentication below to join your organization.',
          {
            link: <ExternalLink href="https://docs.sentry.io/accounts/require-2fa/" />,
          }
        )}
      </StyledAlert>
    );
  }
}

const StyledAlert = styled(Alert)`
  margin: ${space(3)} 0;
`;

export default TwoFactorRequired;
