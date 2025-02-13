import styled from '@emotion/styled';

import {Alert} from 'sentry/components/alert';
import {useInviteMembersContext} from 'sentry/components/modals/inviteMembersModal/inviteMembersContext';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

export function ErrorAlert() {
  const {error} = useInviteMembersContext();
  return error ? (
    <Alert.Container>
      <Alert margin type="error" showIcon>
        {error}
      </Alert>
    </Alert.Container>
  ) : null;
}

export function InviteMessage() {
  const {willInvite} = useInviteMembersContext();
  return willInvite ? (
    <Subtext>{t('Invite unlimited new members to join your organization.')}</Subtext>
  ) : (
    <Alert.Container>
      <Alert margin type="warning" showIcon>
        {t(
          'You can’t invite users directly, but we’ll forward your request to an org owner or manager for approval.'
        )}
      </Alert>
    </Alert.Container>
  );
}

const Subtext = styled('p')`
  color: ${p => p.theme.subText};
  margin-bottom: ${space(3)};
`;
