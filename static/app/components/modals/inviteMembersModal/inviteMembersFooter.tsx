import {Fragment} from 'react';
import styled from '@emotion/styled';

import ButtonBar from 'sentry/components/buttonBar';
import InviteButton from 'sentry/components/modals/inviteMembersModal/inviteButton';
import {useInviteMembersContext} from 'sentry/components/modals/inviteMembersModal/inviteMembersContext';
import InviteStatusMessage from 'sentry/components/modals/inviteMembersModal/inviteStatusMessage';
import {space} from 'sentry/styles/space';
import useOrganization from 'sentry/utils/useOrganization';

interface Props {
  canSend: boolean;
}

export default function InviteMembersFooter({canSend}: Props) {
  const organization = useOrganization();
  const {
    complete,
    inviteStatus,
    setInviteStatus,
    invites,
    pendingInvites,
    sendInvites,
    sendingInvites,
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
    <FooterContent>
      <div>
        {/* TODO(mia): remove these props and use InviteMemberContext once old modal is removed */}
        <InviteStatusMessage
          data-test-id="invite-status-message"
          complete={complete}
          hasDuplicateEmails={false}
          inviteStatus={inviteStatus}
          sendingInvites={sendingInvites}
          willInvite={willInvite}
        />
      </div>
      <ButtonBar gap={1}>
        <Fragment>
          <InviteButton
            invites={invites}
            willInvite={willInvite}
            size="sm"
            data-test-id="send-invites"
            priority="primary"
            disabled={!canSend || !isValidInvites}
            onClick={() => {
              organization.features.includes('invite-members-new-modal') &&
                removeSentInvites();
              sendInvites();
            }}
          />
        </Fragment>
      </ButtonBar>
    </FooterContent>
  );
}

const FooterContent = styled('div')`
  display: flex;
  gap: ${space(1)};
  align-items: center;
  justify-content: space-between;
  flex: 1;
`;
