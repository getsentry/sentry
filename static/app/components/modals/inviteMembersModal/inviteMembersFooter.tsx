import {Flex} from '@sentry/scraps/layout';

import InviteButton from 'sentry/components/modals/inviteMembersModal/inviteButton';
import {useInviteMembersContext} from 'sentry/components/modals/inviteMembersModal/inviteMembersContext';
import InviteStatusMessage from 'sentry/components/modals/inviteMembersModal/inviteStatusMessage';

interface Props {
  canSend: boolean;
}

export default function InviteMembersFooter({canSend}: Props) {
  const {
    inviteStatus,
    setInviteStatus,
    invites,
    pendingInvites,
    sendInvites,
    willInvite,
  } = useInviteMembersContext();
  const isValidInvites = invites.length > 0;

  const removeSentInvites = () => {
    const emails = Object.keys(inviteStatus);
    let newInviteStatus = {};
    emails.forEach(email => {
      if (pendingInvites.emails.has(email)) {
        newInviteStatus = {...newInviteStatus, [email]: inviteStatus[email]};
      }
    });
    setInviteStatus(newInviteStatus);
  };

  return (
    <Flex gap="md" align="center" justify="between" flex="1">
      <div>
        <InviteStatusMessage data-test-id="invite-status-message" />
      </div>
      <InviteButton
        invites={invites}
        willInvite={willInvite}
        size="sm"
        data-test-id="send-invites"
        priority="primary"
        disabled={!canSend || !isValidInvites}
        onClick={() => {
          removeSentInvites();
          sendInvites();
        }}
      />
    </Flex>
  );
}
