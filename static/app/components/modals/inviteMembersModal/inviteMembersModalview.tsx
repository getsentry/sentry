import type {ReactNode} from 'react';
import {Fragment} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import Alert from 'sentry/components/alert';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import InviteButton from 'sentry/components/modals/inviteMembersModal/inviteButton';
import InviteRowControl from 'sentry/components/modals/inviteMembersModal/inviteRowControl';
import InviteStatusMessage from 'sentry/components/modals/inviteMembersModal/inviteStatusMessage';
import type {
  InviteRow,
  InviteStatus,
  NormalizedInvite,
} from 'sentry/components/modals/inviteMembersModal/types';
import {ORG_ROLES} from 'sentry/constants';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Member, Organization} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';

interface Props {
  Footer: ModalRenderProps['Footer'];
  addInviteRow: () => void;
  canSend: boolean;
  closeModal: ModalRenderProps['closeModal'];
  complete: boolean;
  hasDuplicateEmails: boolean;
  headerInfo: ReactNode;
  inviteStatus: InviteStatus;
  invites: NormalizedInvite[];
  isValidInvites: boolean;
  member: Member;
  organization: Organization;
  pendingInvites: InviteRow[];
  removeInviteRow: (index: number) => void;
  reset: () => void;
  sendInvites: () => void;
  sendingInvites: boolean;
  sessionId: string;
  setEmails: (emails: string[], index: number) => void;
  setRole: (role: string, index: number) => void;
  setTeams: (teams: string[], index: number) => void;
  willInvite: boolean;
}

export default function InviteMembersModalView({
  addInviteRow,
  canSend,
  closeModal,
  complete,
  Footer,
  hasDuplicateEmails,
  headerInfo,
  invites,
  inviteStatus,
  isValidInvites,
  member,
  organization,
  pendingInvites,
  removeInviteRow,
  reset,
  sendingInvites,
  sendInvites,
  sessionId,
  setEmails,
  setRole,
  setTeams,
  willInvite,
}: Props) {
  const disableInputs = sendingInvites || complete;

  return (
    <Fragment>
      <Heading>{t('Invite New Members')}</Heading>
      {willInvite ? (
        <Subtext>{t('Invite new members by email to join your organization.')}</Subtext>
      ) : (
        <Alert type="warning" showIcon>
          {t(
            'You can’t invite users directly, but we’ll forward your request to an org owner or manager for approval.'
          )}
        </Alert>
      )}

      {headerInfo}

      <InviteeHeadings>
        <div>{t('Email addresses')}</div>
        <div>{t('Role')}</div>
        <div>{t('Add to team')}</div>
        <div />
      </InviteeHeadings>

      <Rows>
        {pendingInvites.map(({emails, role, teams}, i) => (
          <StyledInviteRow
            key={i}
            disabled={disableInputs}
            emails={[...emails]}
            role={role}
            teams={[...teams]}
            roleOptions={member ? member.roles : ORG_ROLES}
            roleDisabledUnallowed={willInvite}
            inviteStatus={inviteStatus}
            onRemove={() => removeInviteRow(i)}
            onChangeEmails={opts => setEmails(opts?.map(v => v.value) ?? [], i)}
            onChangeRole={value => setRole(value?.value, i)}
            onChangeTeams={opts => setTeams(opts ? opts.map(v => v.value) : [], i)}
            disableRemove={disableInputs || pendingInvites.length === 1}
          />
        ))}
      </Rows>

      <AddButton
        disabled={disableInputs}
        size="sm"
        borderless
        onClick={addInviteRow}
        icon={<IconAdd isCircled />}
      >
        {t('Add another')}
      </AddButton>

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
            {complete ? (
              <Fragment>
                <Button data-test-id="send-more" size="sm" onClick={reset}>
                  {t('Send more invites')}
                </Button>
                <Button
                  data-test-id="close"
                  priority="primary"
                  size="sm"
                  onClick={() => {
                    trackAnalytics('invite_modal.closed', {
                      organization,
                      modal_session: sessionId,
                    });
                    closeModal();
                  }}
                >
                  {t('Close')}
                </Button>
              </Fragment>
            ) : (
              <Fragment>
                <Button
                  data-test-id="cancel"
                  size="sm"
                  onClick={closeModal}
                  disabled={disableInputs}
                >
                  {t('Cancel')}
                </Button>
                <InviteButton
                  invites={invites}
                  willInvite={willInvite}
                  size="sm"
                  data-test-id="send-invites"
                  priority="primary"
                  disabled={!canSend || !isValidInvites || disableInputs}
                  onClick={sendInvites}
                />
              </Fragment>
            )}
          </ButtonBar>
        </FooterContent>
      </Footer>
    </Fragment>
  );
}

const Heading = styled('h1')`
  font-weight: 400;
  font-size: ${p => p.theme.headerFontSize};
  margin-top: 0;
  margin-bottom: ${space(0.75)};
`;

const Subtext = styled('p')`
  color: ${p => p.theme.subText};
  margin-bottom: ${space(3)};
`;

const inviteRowGrid = css`
  display: grid;
  gap: ${space(1.5)};
  grid-template-columns: 3fr 180px 2fr 0.5fr;
  align-items: start;
`;

const InviteeHeadings = styled('div')`
  ${inviteRowGrid};

  margin-bottom: ${space(1)};
  font-weight: 600;
  text-transform: uppercase;
  font-size: ${p => p.theme.fontSizeSmall};
`;

const Rows = styled('ul')`
  list-style: none;
  padding: 0;
  margin: 0;
`;

const StyledInviteRow = styled(InviteRowControl)`
  ${inviteRowGrid};
  margin-bottom: ${space(1.5)};
`;

const AddButton = styled(Button)`
  margin-top: ${space(3)};
`;

const FooterContent = styled('div')`
  display: flex;
  gap: ${space(1)};
  align-items: center;
  justify-content: space-between;
  flex: 1;
`;
