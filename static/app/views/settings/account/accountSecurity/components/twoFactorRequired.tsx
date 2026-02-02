import styled from '@emotion/styled';

import {Alert} from '@sentry/scraps/alert';
import {ExternalLink} from '@sentry/scraps/link';

import {tct} from 'sentry/locale';
import getPendingInvite from 'sentry/utils/getPendingInvite';

export default function TwoFactorRequired() {
  return getPendingInvite() ? (
    <StyledAlert data-test-id="require-2fa" variant="danger">
      {tct(
        'You have been invited to an organization that requires [link:two-factor authentication]. Setup two-factor authentication below to join your organization.',
        {
          link: <ExternalLink href="https://docs.sentry.io/accounts/require-2fa/" />,
        }
      )}
    </StyledAlert>
  ) : null;
}

const StyledAlert = styled(Alert)`
  margin: ${p => p.theme.space['2xl']} 0;
`;
