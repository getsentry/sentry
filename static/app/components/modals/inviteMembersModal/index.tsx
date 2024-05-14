import {css} from '@emotion/react';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import ErrorBoundary from 'sentry/components/errorBoundary';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import InviteMembersModalView from 'sentry/components/modals/inviteMembersModal/inviteMembersModalview';
import type {InviteRow} from 'sentry/components/modals/inviteMembersModal/types';
import useInviteModal from 'sentry/components/modals/inviteMembersModal/useInviteModal';
import {InviteModalHook} from 'sentry/components/modals/memberInviteModalCustomization';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';
import useOrganization from 'sentry/utils/useOrganization';

interface InviteMembersModalProps extends ModalRenderProps {
  initialData?: Partial<InviteRow>[];
  source?: string;
}

function InviteMembersModal({
  closeModal,
  initialData,
  source,
  Footer,
}: InviteMembersModalProps) {
  const organization = useOrganization();

  const {
    addInviteRow,
    invites,
    memberResult,
    removeInviteRow,
    reset,
    sendInvites,
    sessionId,
    setEmails,
    setRole,
    setTeams,
    willInvite,
    complete,
    inviteStatus,
    pendingInvites,
    sendingInvites,
    error,
  } = useInviteModal({
    initialData,
    organization,
    source,
  });

  if (memberResult.isLoading) {
    return <LoadingIndicator />;
  }

  if (memberResult.isError && !isActiveSuperuser()) {
    return (
      <LoadingError
        message={t('Failed to load members')}
        onRetry={memberResult.refetch}
      />
    );
  }

  return (
    <ErrorBoundary>
      <InviteModalHook
        organization={organization}
        willInvite={willInvite}
        onSendInvites={sendInvites}
      >
        {({sendInvites: _sendInvites, canSend, headerInfo}) => {
          return (
            <InviteMembersModalView
              addInviteRow={addInviteRow}
              canSend={canSend}
              closeModal={() => {
                trackAnalytics('invite_modal.closed', {
                  organization,
                  modal_session: sessionId,
                });
                closeModal();
              }}
              complete={complete}
              Footer={Footer}
              headerInfo={headerInfo}
              invites={invites}
              inviteStatus={inviteStatus}
              member={memberResult.data}
              pendingInvites={pendingInvites}
              removeInviteRow={removeInviteRow}
              reset={reset}
              sendingInvites={sendingInvites}
              sendInvites={sendInvites}
              setEmails={setEmails}
              setRole={setRole}
              setTeams={setTeams}
              willInvite={willInvite}
              error={error}
            />
          );
        }}
      </InviteModalHook>
    </ErrorBoundary>
  );
}

export const modalCss = css`
  width: 100%;
  max-width: 900px;
  margin: 50px auto;
`;

export default InviteMembersModal;
