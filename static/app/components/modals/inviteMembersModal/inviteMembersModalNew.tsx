import type {ReactNode} from 'react';
import {Fragment} from 'react';
import styled from '@emotion/styled';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import Alert from 'sentry/components/alert';
import ButtonBar from 'sentry/components/buttonBar';
import InviteButton from 'sentry/components/modals/inviteMembersModal/inviteButton';
import InviteRowControl from 'sentry/components/modals/inviteMembersModal/inviteRowControlNew';
import InviteStatusMessage from 'sentry/components/modals/inviteMembersModal/inviteStatusMessage';
import type {
  InviteRow,
  InviteStatus,
  NormalizedInvite,
} from 'sentry/components/modals/inviteMembersModal/types';
import {ORG_ROLES} from 'sentry/constants';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Member} from 'sentry/types/organization';

interface Props {
  Body: ModalRenderProps['Body'];
  Footer: ModalRenderProps['Footer'];
  Header: ModalRenderProps['Header'];
  canSend: boolean;
  complete: boolean;
  headerInfo: ReactNode;
  inviteStatus: InviteStatus;
  invites: NormalizedInvite[];
  member: Member | undefined;
  pendingInvites: InviteRow[];
  reset: () => void;
  sendInvites: () => void;
  sendingInvites: boolean;
  setEmails: (emails: string[], index: number) => void;
  setRole: (role: string, index: number) => void;
  setTeams: (teams: string[], index: number) => void;
  willInvite: boolean;
  error?: string;
}

export default function InviteMembersModalNew({
  canSend,
  complete,
  Header,
  Body,
  Footer,
  headerInfo,
  invites,
  inviteStatus,
  member,
  pendingInvites,
  reset,
  sendingInvites,
  sendInvites,
  setEmails,
  setRole,
  setTeams,
  willInvite,
  error,
}: Props) {
  const inviteEmails = invites.map(inv => inv.email);
  const hasDuplicateEmails = inviteEmails.length !== new Set(inviteEmails).size;
  const isValidInvites = invites.length > 0 && !hasDuplicateEmails;

  const errorAlert = error ? (
    <Alert type="error" showIcon>
      {error}
    </Alert>
  ) : null;

  return (
    <Fragment>
      <Header closeButton>
        {errorAlert}
        <Heading>{t('Invite New Members')}</Heading>
      </Header>
      <Body>
        {willInvite ? (
          <Subtext>
            {t('Invite unlimited new members to join your organization.')}
          </Subtext>
        ) : (
          <Alert type="warning" showIcon>
            {t(
              'You can’t invite users directly, but we’ll forward your request to an org owner or manager for approval.'
            )}
          </Alert>
        )}

        {headerInfo}

        <Rows>
          {pendingInvites.map(({emails, role, teams}, i) => (
            <StyledInviteRow
              key={i}
              disabled={false}
              emails={[...emails]}
              role={role}
              teams={[...teams]}
              roleOptions={member?.orgRoleList ?? ORG_ROLES}
              roleDisabledUnallowed={willInvite}
              inviteStatus={inviteStatus}
              onRemove={reset}
              onChangeEmails={opts => setEmails(opts?.map(v => v.value) ?? [], i)}
              onChangeRole={value => setRole(value?.value, i)}
              onChangeTeams={opts => setTeams(opts ? opts.map(v => v.value) : [], i)}
            />
          ))}
        </Rows>

        <Footer>
          <FooterContent>
            <div>
              <InviteStatusMessage
                complete={complete}
                hasDuplicateEmails={hasDuplicateEmails}
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
        </Footer>
      </Body>
    </Fragment>
  );
}

const Heading = styled('h1')`
  font-weight: ${p => p.theme.fontWeightNormal};
  font-size: ${p => p.theme.headerFontSize};
  margin-top: 0;
  margin-bottom: ${space(0.75)};
`;

const Subtext = styled('p')`
  color: ${p => p.theme.subText};
  margin-bottom: ${space(3)};
`;

const Rows = styled('ul')`
  list-style: none;
  padding: 0;
  margin: 0;
`;

const StyledInviteRow = styled(InviteRowControl)`
  margin-bottom: ${space(1.5)};
`;

const FooterContent = styled('div')`
  display: flex;
  gap: ${space(1)};
  align-items: center;
  justify-content: space-between;
  flex: 1;
`;
