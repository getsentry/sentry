import {Fragment, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import Checkbox from 'sentry/components/checkbox';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {
  InviteModalHook,
  InviteModalRenderFunc,
  StatusMessage,
} from 'sentry/components/modals/inviteMembersModal';
import {InviteStatus} from 'sentry/components/modals/inviteMembersModal/types';
import {MissingMemberInvite} from 'sentry/components/modals/inviteMissingMembersModal/types';
import PanelItem from 'sentry/components/panels/panelItem';
import PanelTable from 'sentry/components/panels/panelTable';
import RoleSelectControl from 'sentry/components/roleSelectControl';
import TeamSelector from 'sentry/components/teamSelector';
import {Tooltip} from 'sentry/components/tooltip';
import {IconCheckmark, IconChevron, IconCommit, IconGithub, IconInfo} from 'sentry/icons';
import {t, tct, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {MissingMember, Organization, OrgRole} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';
import useApi from 'sentry/utils/useApi';
import {StyledExternalLink} from 'sentry/views/settings/organizationMembers/inviteBanner';

const ROWS_PER_PAGE = 6;

export interface InviteMissingMembersModalProps extends ModalRenderProps {
  allowedRoles: OrgRole[];
  missingMembers: {integration: string; users: MissingMember[]};
  organization: Organization;
}

export function InviteMissingMembersModal({
  missingMembers,
  organization,
  allowedRoles,
  closeModal,
}: InviteMissingMembersModalProps) {
  const initialMemberInvites = (missingMembers.users || []).map(member => ({
    email: member.email,
    commitCount: member.commitCount,
    role: organization.defaultRole,
    teamSlugs: new Set<string>(),
    externalId: member.externalId,
    selected: false,
  }));
  const pageCount = Math.floor(initialMemberInvites.length / ROWS_PER_PAGE);
  const [memberInvites, setMemberInvites] =
    useState<MissingMemberInvite[]>(initialMemberInvites);
  const referrer = missingMembers.integration + '_nudge_invite';
  const [inviteStatus, setInviteStatus] = useState<InviteStatus>({});
  const [sendingInvites, setSendingInvites] = useState(false);
  const [complete, setComplete] = useState(false);
  const [currentPage, setCurrentPage] = useState<number>(0);

  const api = useApi();

  if (memberInvites.length === 0 || !organization.access.includes('org:write')) {
    return null;
  }

  const setRole = (role: string, email: string) => {
    setMemberInvites(currentMemberInvites =>
      currentMemberInvites.map(member => {
        if (member.email === email) {
          member.role = role;
        }
        return member;
      })
    );
  };

  const setTeams = (teamSlugs: string[], email: string) => {
    setMemberInvites(currentMemberInvites =>
      currentMemberInvites.map(member => {
        if (member.email === email) {
          member.teamSlugs = new Set(teamSlugs);
        }
        return member;
      })
    );
  };

  const selectAllOnPage = (checked: boolean) => {
    const selectedMembers = memberInvites.map((m, i) => {
      if (i >= currentPage * ROWS_PER_PAGE && i < (currentPage + 1) * ROWS_PER_PAGE) {
        return {...m, selected: checked};
      }
      return m;
    });
    setMemberInvites(selectedMembers);
  };

  const toggleCheckbox = (checked: boolean, index: number) => {
    const selectedMembers = [...memberInvites];
    selectedMembers[index].selected = checked;
    setMemberInvites(selectedMembers);
  };

  const renderStatusMessage = () => {
    if (sendingInvites) {
      return (
        <StatusMessage>
          <LoadingIndicator mini relative hideMessage size={16} />
          {t('Sending organization invitations\u2026')}
        </StatusMessage>
      );
    }

    if (complete) {
      const statuses = Object.values(inviteStatus);
      const sentCount = statuses.filter(i => i.sent).length;
      const errorCount = statuses.filter(i => i.error).length;

      const invites = <strong>{tn('%s invite', '%s invites', sentCount)}</strong>;
      const tctComponents = {
        invites,
        failed: errorCount,
      };

      return (
        <StatusMessage status="success">
          <IconCheckmark size="sm" />
          {errorCount > 0
            ? tct('Sent [invites], [failed] failed to send.', tctComponents)
            : tct('Sent [invites]', tctComponents)}
        </StatusMessage>
      );
    }

    return null;
  };

  const sendMemberInvite = async (invite: MissingMemberInvite) => {
    const data = {
      email: invite.email,
      teams: [...invite.teamSlugs],
      role: invite.role,
    };

    try {
      await api.requestPromise(
        `/organizations/${organization?.slug}/members/?referrer=${referrer}`,
        {
          method: 'POST',
          data,
        }
      );
    } catch (err) {
      const errorResponse = err.responseJSON;

      // Use the email error message if available. This inconsistently is
      // returned as either a list of errors for the field, or a single error.
      const emailError =
        !errorResponse || !errorResponse.email
          ? false
          : Array.isArray(errorResponse.email)
          ? errorResponse.email[0]
          : errorResponse.email;

      const error = emailError || t('Could not invite user');

      setInviteStatus(prevInviteStatus => {
        return {...prevInviteStatus, [invite.email]: {sent: false, error}};
      });
    }

    setInviteStatus(prevInviteStatus => {
      return {...prevInviteStatus, [invite.email]: {sent: true}};
    });
  };

  const sendMemberInvites = async () => {
    setSendingInvites(true);
    await Promise.all(memberInvites.filter(i => i.selected).map(sendMemberInvite));
    setSendingInvites(false);
    setComplete(true);

    if (organization) {
      trackAnalytics(
        'missing_members_invite_modal.requests_sent',
        {
          organization,
        },
        {startSession: true}
      );
    }
  };

  const membersOnPage = memberInvites?.slice(
    currentPage * ROWS_PER_PAGE,
    (currentPage + 1) * ROWS_PER_PAGE
  );
  const selectedCount = memberInvites.filter(i => i.selected).length;
  const selectedAllOnPage =
    membersOnPage.filter(i => i.selected).length === membersOnPage.length;

  const inviteButtonLabel = () => {
    return tct('Invite [memberCount] missing member[isPlural]', {
      memberCount:
        memberInvites.length === selectedCount
          ? `all ${selectedCount}`
          : selectedCount === 0
          ? ''
          : selectedCount,
      isPlural: selectedCount !== 1 ? 's' : '',
    });
  };

  const hookRenderer: InviteModalRenderFunc = ({sendInvites, canSend, headerInfo}) => (
    <Fragment>
      <h4>{t('Invite Your Dev Team')}</h4>
      {headerInfo}
      <StyledPanelTable
        headers={[
          <Checkbox
            key={0}
            aria-label={
              selectedAllOnPage ? t('Deselect All On Page') : t('Select All On Page')
            }
            onChange={() => selectAllOnPage(!selectedAllOnPage)}
            checked={selectedAllOnPage}
          />,
          t('User Information'),
          <StyledHeader key={1}>
            {t('Recent Commits')}
            <Tooltip title={t('Based on the last 30 days of commit data')}>
              <IconInfo size="xs" />
            </Tooltip>
          </StyledHeader>,
          t('Role'),
          t('Team'),
        ]}
      >
        {membersOnPage.map((member, i) => {
          const checked = member.selected;
          const username = member.externalId.split(':').pop();
          return (
            <Fragment key={i}>
              <div>
                <Checkbox
                  aria-label={t('Select %s', member.email)}
                  checked={checked}
                  onChange={() => toggleCheckbox(!checked, i)}
                />
              </div>
              <StyledPanelItem>
                <ContentRow>
                  <IconGithub size="sm" />
                  <StyledExternalLink href={`https://github.com/${username}`}>
                    @{username}
                  </StyledExternalLink>
                </ContentRow>
                <MemberEmail>{member.email}</MemberEmail>
              </StyledPanelItem>
              <ContentRow>
                <IconCommit size="sm" />
                {member.commitCount}
              </ContentRow>
              <RoleSelectControl
                aria-label={t('Role')}
                data-test-id="select-role"
                disabled={false}
                roles={allowedRoles}
                disableUnallowed
                onChange={value => setRole(value?.value, member.email)}
              />
              <TeamSelector
                organization={organization}
                aria-label={t('Add to Team')}
                data-test-id="select-teams"
                disabled={false}
                placeholder={t('Add to teams\u2026')}
                onChange={opts =>
                  setTeams(opts ? opts.map(v => v.value) : [], member.email)
                }
                multiple
                clearable
              />
            </Fragment>
          );
        })}
      </StyledPanelTable>
      <Footer>
        <Wrapper data-test-id="pagination">
          <ButtonBar merged>
            <Button
              icon={<IconChevron direction="left" size="sm" />}
              aria-label={t('Previous')}
              size="sm"
              disabled={currentPage === 0}
              onClick={() => setCurrentPage(currentPage - 1)}
            />
            <Button
              icon={<IconChevron direction="right" size="sm" />}
              aria-label={t('Next')}
              size="sm"
              disabled={currentPage === pageCount}
              onClick={() => setCurrentPage(currentPage + 1)}
            />
          </ButtonBar>
          {renderStatusMessage()}
        </Wrapper>
        <ButtonBar gap={1}>
          <Button
            size="sm"
            onClick={() => {
              closeModal();
            }}
          >
            {t('Cancel')}
          </Button>
          <Button
            size="sm"
            priority="primary"
            aria-label={t('Send Invites')}
            onClick={sendInvites}
            disabled={!canSend || selectedCount === 0}
            analyticsEventName="Github Invite Modal: Invite"
            analyticsEventKey="github_invite_modal.invite"
            analyticsParams={{
              invited_all: memberInvites.length === selectedCount,
              invited_count: selectedCount,
            }}
          >
            {inviteButtonLabel()}
          </Button>
        </ButtonBar>
      </Footer>
    </Fragment>
  );

  return (
    <InviteModalHook
      organization={organization}
      willInvite
      onSendInvites={sendMemberInvites}
    >
      {hookRenderer}
    </InviteModalHook>
  );
}

export default InviteMissingMembersModal;

const StyledPanelTable = styled(PanelTable)`
  grid-template-columns: max-content 1fr max-content 1fr 1fr;
  overflow: visible;
`;

const StyledHeader = styled('div')`
  display: flex;
  gap: ${space(0.5)};
`;

const StyledPanelItem = styled(PanelItem)`
  flex-direction: column;
`;

const Footer = styled('div')`
  display: flex;
  justify-content: space-between;
`;

const ContentRow = styled('div')`
  display: flex;
  align-items: center;
  font-size: ${p => p.theme.fontSizeMedium};
  gap: ${space(0.75)};
`;

const MemberEmail = styled('div')`
  display: block;
  max-width: 150px;
  font-size: ${p => p.theme.fontSizeSmall};
  font-weight: 400;
  color: ${p => p.theme.gray300};
  text-overflow: ellipsis;
  overflow: hidden;
`;

const Wrapper = styled('div')`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: ${space(1.5)};
`;

export const modalCss = css`
  width: 80%;
  max-width: 870px;
`;
