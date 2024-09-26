import {Fragment, useContext} from 'react';
import styled from '@emotion/styled';

import ButtonBar from 'sentry/components/buttonBar';
import InviteButton from 'sentry/components/modals/inviteMembersModal/inviteButton';
import {InviteMembersContext} from 'sentry/components/modals/inviteMembersModal/inviteMembersContext';
import InviteStatusMessage from 'sentry/components/modals/inviteMembersModal/inviteStatusMessage';
import {space} from 'sentry/styles/space';

interface Props {
  canSend: boolean;
}

export default function InviteMembersFooter({canSend}: Props) {
  const {complete, inviteStatus, invites, sendInvites, sendingInvites, willInvite} =
    useContext(InviteMembersContext);
  const isValidInvites = invites.length > 0;

  return (
    <FooterContent>
      <div>
        {/* TODO(mia): remove these props and use InviteMemberContext once old modal is removed */}
        <InviteStatusMessage
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
            onClick={sendInvites}
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
