import {css} from '@emotion/react';
import styled from '@emotion/styled';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import ErrorBoundary from 'sentry/components/errorBoundary';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {
  ErrorAlert,
  InviteMessage,
} from 'sentry/components/modals/inviteMembersModal/inviteHeaderMessages';
import {InviteMembersContext} from 'sentry/components/modals/inviteMembersModal/inviteMembersContext';
import InviteMembersFooter from 'sentry/components/modals/inviteMembersModal/inviteMembersFooter';
import InviteMembersModalView from 'sentry/components/modals/inviteMembersModal/inviteMembersModalview';
import InviteRowControl from 'sentry/components/modals/inviteMembersModal/inviteRowControlNew';
import type {InviteRow} from 'sentry/components/modals/inviteMembersModal/types';
import useInviteModal from 'sentry/components/modals/inviteMembersModal/useInviteModal';
import {InviteModalHook} from 'sentry/components/modals/memberInviteModalCustomization';
import {ORG_ROLES} from 'sentry/constants';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';
import useOrganization from 'sentry/utils/useOrganization';

interface InviteMembersModalProps extends ModalRenderProps {
  initialData?: Partial<InviteRow>[];
  source?: string;
}

function InviteMembersModal({
  Header,
  Body,
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
    setInviteStatus,
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

  if (memberResult.isPending) {
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
        {({
          sendInvites: inviteModalSendInvites,
          canSend: canSend,
          headerInfo: headerInfo,
          isOverMemberLimit: isOverMemberLimit,
        }) => {
          return organization.features.includes('invite-members-new-modal') ? (
            <InviteMembersContext.Provider
              value={{
                willInvite,
                invites,
                setEmails,
                setRole,
                setTeams,
                setInviteStatus,
                sendInvites: inviteModalSendInvites,
                reset,
                inviteStatus,
                pendingInvites: pendingInvites[0]!,
                sendingInvites,
                complete,
                error,
                isOverMemberLimit,
              }}
            >
              <Header closeButton>
                <ErrorAlert />
                <Heading>{t('Invite New Members')}</Heading>
              </Header>
              <Body>
                <InviteMessage />
                {headerInfo}
                <StyledInviteRow
                  roleOptions={memberResult.data?.orgRoleList ?? ORG_ROLES}
                  roleDisabledUnallowed={willInvite}
                />
              </Body>
              <Footer>
                <InviteMembersFooter canSend />
              </Footer>
            </InviteMembersContext.Provider>
          ) : (
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
              isOverMemberLimit={
                isOverMemberLimit && organization.features.includes('invite-billing')
              }
              member={memberResult.data}
              pendingInvites={pendingInvites}
              removeInviteRow={removeInviteRow}
              reset={reset}
              sendingInvites={sendingInvites}
              sendInvites={inviteModalSendInvites}
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

const Heading = styled('h1')`
  font-weight: ${p => p.theme.fontWeightNormal};
  font-size: ${p => p.theme.headerFontSize};
  margin-top: 0;
  margin-bottom: ${space(0.75)};
`;

const StyledInviteRow = styled(InviteRowControl)`
  margin-bottom: ${space(1.5)};
`;

export default InviteMembersModal;
