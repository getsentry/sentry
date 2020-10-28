import React from 'react';
import styled from '@emotion/styled';

import {tct} from 'app/locale';
import Alert from 'app/components/alert';
import ExternalLink from 'app/components/links/externalLink';
import {IconFlag} from 'app/icons';
import space from 'app/styles/space';
import getPendingInvite from 'app/utils/getPendingInvite';

const TwoFactorRequired = () =>
  !getPendingInvite() ? null : (
    <StyledAlert data-test-id="require-2fa" type="error" icon={<IconFlag size="md" />}>
      {tct(
        'You have been invited to an organization that requires [link:two-factor authentication].' +
          ' Setup two-factor authentication below to join your organization.',
        {
          link: <ExternalLink href="https://docs.sentry.io/accounts/require-2fa/" />,
        }
      )}
    </StyledAlert>
  );

const StyledAlert = styled(Alert)`
  margin: ${space(3)} 0;
`;

export default TwoFactorRequired;
