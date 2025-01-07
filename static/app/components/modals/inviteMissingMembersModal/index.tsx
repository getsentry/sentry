import {Fragment, useCallback, useMemo, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import Checkbox from 'sentry/components/checkbox';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {StatusMessage} from 'sentry/components/modals/inviteMembersModal/inviteStatusMessage';
import type {InviteStatus} from 'sentry/components/modals/inviteMembersModal/types';
import type {MissingMemberInvite} from 'sentry/components/modals/inviteMissingMembersModal/types';
import type {InviteModalRenderFunc} from 'sentry/components/modals/memberInviteModalCustomization';
import {InviteModalHook} from 'sentry/components/modals/memberInviteModalCustomization';
import PanelItem from 'sentry/components/panels/panelItem';
import {PanelTable} from 'sentry/components/panels/panelTable';
import RoleSelectControl from 'sentry/components/roleSelectControl';
import TeamSelector from 'sentry/components/teamSelector';
import {Tooltip} from 'sentry/components/tooltip';
import {IconCheckmark, IconCommit, IconGithub, IconInfo} from 'sentry/icons';
import {t, tct, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {MissingMember, Organization, OrgRole} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import useApi from 'sentry/utils/useApi';
import {StyledExternalLink} from 'sentry/views/settings/organizationMembers/inviteBanner';

export interface InviteMissingMembersModalProps extends ModalRenderProps {
  allowedRoles: OrgRole[];
  // the API response returns {integration: "github", users: []}
  // but we only ever return Github missing members at the moment
  // so we can simplify the props and state to only store the users (missingMembers)
  missingMembers: MissingMember[];
  organization: Organization;
}

export function InviteMissingMembersModal({
  missingMembers,
  organization,
  allowedRoles,
  closeModal,
  modalContainerRef,
}: InviteMissingMembersModalProps) {
  const initialMemberInvites = (missingMembers || []).map(member => ({
    email: member.email,
    commitCount: member.commitCount,
    role: organization.defaultRole,
    teamSlugs: new Set<string>(),
    externalId: member.externalId,
    selected: true,
  }));
  const [memberInvites, setMemberInvites] =
    useState<MissingMemberInvite[]>(initialMemberInvites);
  const referrer = 'github_nudge_invite';
  const [inviteStatus, setInviteStatus] = useState<InviteStatus>({});
  const [sendingInvites, setSendingInvites] = useState(false);
  const [complete, setComplete] = useState(false);

  const api = useApi();

  const allowedRolesMap = useMemo<Record<string, OrgRole>>(
    () => allowedRoles.reduce((rolesMap, role) => ({...rolesMap, [role.id]: role}), {}),
    [allowedRoles]
  );

  const setRole = useCallback(
    (role: string, index: number) => {
      setMemberInvites(prevInvites => {
        const invites = prevInvites.map(i => ({...i}));
        invites[index]!.role = role;
        if (!allowedRolesMap[role]!.isTeamRolesAllowed) {
          invites[index]!.teamSlugs = new Set([]);
        }
        return invites;
      });
    },
    [allowedRolesMap]
  );

  const setTeams = useCallback((teamSlugs: string[], index: number) => {
    setMemberInvites(prevInvites => {
      const invites = prevInvites.map(i => ({...i}));
      invites[index]!.teamSlugs = new Set(teamSlugs);
      return invites;
    });
  }, []);

  const selectAll = useCallback(
    (checked: boolean) => {
      const selectedMembers = memberInvites.map(m => ({...m, selected: checked}));
      setMemberInvites(selectedMembers);
    },
    [memberInvites]
  );

  const toggleCheckbox = useCallback(
    (checked: boolean, index: number) => {
      const selectedMembers = [...memberInvites];
      selectedMembers[index]!.selected = checked;
      setMemberInvites(selectedMembers);
    },
    [memberInvites]
  );

  if (memberInvites.length === 0 || !organization.access.includes('org:write')) {
    return null;
  }

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
          <span>
            {errorCount > 0
              ? tct('Sent [invites], [failed] failed to send.', tctComponents)
              : tct('Sent [invites]', tctComponents)}
          </span>
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

  const selectedCount = memberInvites.filter(i => i.selected).length;
  const selectedAll = memberInvites.length === selectedCount;

  const inviteButtonLabel = () => {
    return tct('Invite [prefix][memberCount] missing member[isPlural]', {
      prefix: memberInvites.length === selectedCount ? 'all ' : '',
      memberCount: selectedCount === 0 ? '' : selectedCount,
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
            aria-label={selectedAll ? t('Deselect All') : t('Select All')}
            onChange={() => selectAll(!selectedAll)}
            checked={selectedAll}
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
        stickyHeaders
      >
        {memberInvites?.map((member, i) => {
          const checked = memberInvites[i]!.selected;
          const username = member.externalId.split(':').pop();
          const isTeamRolesAllowed =
            allowedRolesMap[member.role]?.isTeamRolesAllowed ?? true;
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
                value={member.role}
                roles={allowedRoles}
                disableUnallowed
                onChange={value => setRole(value?.value, i)}
                menuPortalTarget={modalContainerRef?.current}
                isInsideModal
              />
              <TeamSelector
                organization={organization}
                aria-label={t('Add to Team')}
                data-test-id="select-teams"
                disabled={!isTeamRolesAllowed}
                placeholder={isTeamRolesAllowed ? t('None') : t('Role cannot join teams')}
                onChange={opts => setTeams(opts ? opts.map(v => v.value) : [], i)}
                multiple
                clearable
                menuPortalTarget={modalContainerRef?.current}
                isInsideModal
              />
            </Fragment>
          );
        })}
      </StyledPanelTable>
      <Footer>
        <div>{renderStatusMessage()}</div>
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
  overflow: scroll;
  max-height: 475px;
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
  font-weight: ${p => p.theme.fontWeightNormal};
  color: ${p => p.theme.gray300};
  text-overflow: ellipsis;
  overflow: hidden;
`;

export const modalCss = css`
  width: 80%;
  max-width: 870px;
`;
