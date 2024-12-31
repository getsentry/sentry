import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {
  openInviteMembersModal,
  openTeamAccessRequestModal,
} from 'sentry/actionCreators/modal';
import {joinTeam, leaveTeam} from 'sentry/actionCreators/teams';
import type {Client} from 'sentry/api';
import {hasEveryAccess} from 'sentry/components/acl/access';
import UserAvatar from 'sentry/components/avatar/userAvatar';
import {Flex} from 'sentry/components/container/flex';
import DropdownAutoComplete from 'sentry/components/dropdownAutoComplete';
import type {Item} from 'sentry/components/dropdownAutoComplete/types';
import DropdownButton from 'sentry/components/dropdownButton';
import EmptyMessage from 'sentry/components/emptyMessage';
import Link from 'sentry/components/links/link';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Pagination from 'sentry/components/pagination';
import Panel from 'sentry/components/panels/panel';
import PanelHeader from 'sentry/components/panels/panelHeader';
import {TeamRoleColumnLabel} from 'sentry/components/teamRoleUtils';
import {IconUser} from 'sentry/icons';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {space} from 'sentry/styles/space';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import type {Member, Organization, Team, TeamMember} from 'sentry/types/organization';
import type {Config} from 'sentry/types/system';
import {useApiQuery} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useApi from 'sentry/utils/useApi';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import TextBlock from 'sentry/views/settings/components/text/textBlock';
import TeamMembersRow, {
  GRID_TEMPLATE,
} from 'sentry/views/settings/organizationTeams/teamMembersRow';
import PermissionAlert from 'sentry/views/settings/project/permissionAlert';

import {getButtonHelpText} from './utils';

type RouteParams = {
  teamId: string;
};

interface Props extends RouteComponentProps<RouteParams, {}> {
  api: Client;
  config: Config;
  organization: Organization;
  team: Team;
}

function AddMemberDropdown({
  teamMembers,
  organization,
  team,
  teamId,
  isTeamAdmin,
}: {
  isTeamAdmin: boolean;
  organization: Organization;
  team: Team;
  teamId: string;
  teamMembers: TeamMember[];
}) {
  const api = useApi({persistInFlight: true});
  const [memberQuery, setMemberQuery] = useState('');
  const debouncedMemberQuery = useDebouncedValue(memberQuery, 50);
  const {data: orgMembers = [], isLoading: isOrgMembersLoading} = useApiQuery<Member[]>(
    [
      `/organizations/${organization.slug}/members/`,
      {
        query: debouncedMemberQuery ? {query: debouncedMemberQuery} : undefined,
      },
    ],
    {
      staleTime: 0,
    }
  );

  const existingMembers = new Set(teamMembers.map(member => member.id));

  // members can add other members to a team if the `Open Membership` setting is enabled
  // otherwise, `org:write` or `team:admin` permissions are required
  const hasOpenMembership = !!organization?.openMembership;
  const canAddMembers = hasOpenMembership || isTeamAdmin;

  const isDropdownDisabled = team.flags['idp:provisioned'];

  const addTeamMember = (selection: Item) => {
    // Reset members list after adding member to team
    setMemberQuery('');

    joinTeam(
      api,
      {
        orgId: organization.slug,
        teamId,
        memberId: selection.value,
      },
      {
        success: () => {
          const orgMember = orgMembers.find(member => member.id === selection.value);
          if (orgMember === undefined) {
            return;
          }
          // this.setState({
          //   error: false,
          //   teamMembers: teamMembers.concat([orgMember as TeamMember]),
          // });
          addSuccessMessage(t('Successfully added member to team.'));
        },
        error: (resp: RequestError) => {
          const errorMessage =
            resp?.responseJSON?.detail || t('Unable to add team member.');
          addErrorMessage(errorMessage as string);
        },
      }
    );
  };

  /**
   * We perform an API request to support orgs with > 100 members (since that's the max API returns)
   *
   * @param {Event} e React Event when member filter input changes
   */
  const handleMemberFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMemberQuery(e.target.value);
    // this.setState({dropdownBusy: true});
  };

  const items = (orgMembers || [])
    .filter(m => !existingMembers.has(m.id))
    .map(m => ({
      searchKey: `${m.name} ${m.email}`,
      value: m.id,
      label: (
        <StyledUserListElement>
          <StyledAvatar user={m} size={24} className="avatar" />
          <StyledNameOrEmail>{m.name || m.email}</StyledNameOrEmail>
        </StyledUserListElement>
      ),
    }));

  const menuHeader = (
    <StyledMembersLabel>
      {t('Members')}
      <StyledCreateMemberLink
        to=""
        onClick={() => openInviteMembersModal({source: 'teams'})}
        data-test-id="invite-member"
      >
        {t('Invite Member')}
      </StyledCreateMemberLink>
    </StyledMembersLabel>
  );

  return (
    <DropdownAutoComplete
      closeOnSelect={false}
      items={items}
      alignMenu="right"
      onSelect={
        canAddMembers
          ? addTeamMember
          : selection =>
              openTeamAccessRequestModal({
                teamId,
                orgId: organization.slug,
                memberId: selection.value,
              })
      }
      menuHeader={menuHeader}
      emptyMessage={t('No members')}
      onChange={handleMemberFilterChange}
      onClose={() => setMemberQuery('')}
      disabled={isDropdownDisabled}
      data-test-id="add-member-menu"
      busy={isOrgMembersLoading}
    >
      {({isOpen}) => (
        <DropdownButton
          isOpen={isOpen}
          size="xs"
          data-test-id="add-member"
          disabled={isDropdownDisabled}
        >
          {t('Add Member')}
        </DropdownButton>
      )}
    </DropdownAutoComplete>
  );
}

function TeamMembers({team}: Props) {
  const config = useLegacyStore(ConfigStore);
  const api = useApi({persistInFlight: true});
  const organization = useOrganization();
  const {teamId} = useParams<{teamId: string}>();
  const location = useLocation();

  const {
    data: teamMembers = [],
    isError: isTeamMembersError,
    isLoading: isTeamMembersLoading,
    refetch: refetchTeamMembers,
    getResponseHeader: getTeamMemberResponseHeader,
  } = useApiQuery<TeamMember[]>(
    [
      `/teams/${organization.slug}/${teamId}/members/`,
      {
        query: {
          cursor: location.query.cursor,
          query: location.query.query,
        },
      },
    ],
    {
      staleTime: 0,
    }
  );

  if (isTeamMembersError) {
    return <LoadingError onRetry={refetchTeamMembers} />;
  }

  const teamMembersPageLinks = getTeamMemberResponseHeader?.('Link');

  const hasOrgWriteAccess = hasEveryAccess(['org:write'], {organization, team});
  const hasTeamAdminAccess = hasEveryAccess(['team:admin'], {organization, team});
  const isTeamAdmin = hasOrgWriteAccess || hasTeamAdminAccess;

  const removeTeamMember = (member: Member) => {
    leaveTeam(
      api,
      {
        orgId: organization.slug,
        teamId,
        memberId: member.id,
      },
      {
        success: () => {
          // this.setState({
          //   teamMembers: teamMembers.filter(m => m.id !== member.id),
          // });
          addSuccessMessage(t('Successfully removed member from team.'));
        },
        error: () =>
          addErrorMessage(
            t('There was an error while trying to remove a member from the team.')
          ),
      }
    );
  };

  const updateTeamMemberRole = (member: Member, newRole: string) => {
    const endpoint = `/organizations/${organization.slug}/members/${member.id}/teams/${teamId}/`;

    api.request(endpoint, {
      method: 'PUT',
      data: {teamRole: newRole},
      success: data => {
        const newTeamMembers = [...teamMembers];
        const i = newTeamMembers.findIndex(m => m.id === member.id);
        newTeamMembers[i] = {
          ...member,
          teamRole: data.teamRole,
        };
        // this.setState({teamMembers});
        addSuccessMessage(t('Successfully changed role for team member.'));
      },
      error: () => {
        addErrorMessage(
          t('There was an error while trying to change the roles for a team member.')
        );
      },
    });
  };

  const renderPageTextBlock = () => {
    const {openMembership} = organization;
    const isIdpProvisioned = team.flags['idp:provisioned'];

    if (isIdpProvisioned) {
      return getButtonHelpText(isIdpProvisioned);
    }

    return openMembership
      ? t(
          '"Open Membership" is enabled for the organization. Anyone can add members for this team.'
        )
      : t(
          '"Open Membership" is disabled for the organization. Org Owner/Manager/Admin, or Team Admins can add members for this team.'
        );
  };

  const renderMembers = () => {
    if (isTeamMembersLoading) {
      return <LoadingIndicator />;
    }
    if (teamMembers.length) {
      return teamMembers.map(member => {
        return (
          <TeamMembersRow
            key={member.id}
            hasWriteAccess={isTeamAdmin}
            organization={organization}
            team={team}
            member={member}
            user={config.user}
            removeMember={removeTeamMember}
            updateMemberRole={updateTeamMemberRole}
          />
        );
      });
    }
    return (
      <EmptyMessage icon={<IconUser size="xl" />} size="large">
        {t('This team has no members')}
      </EmptyMessage>
    );
  };

  return (
    <Fragment>
      <TextBlock>{renderPageTextBlock()}</TextBlock>

      <PermissionAlert
        access={organization.openMembership ? ['org:read'] : ['team:write']}
        team={team}
      />

      <Panel>
        <StyledPanelHeader hasButtons>
          <div>{t('Members')}</div>
          <div>
            <TeamRoleColumnLabel />
          </div>
          <Flex justify="end">
            <AddMemberDropdown
              teamMembers={teamMembers}
              organization={organization}
              team={team}
              teamId={teamId}
              isTeamAdmin={isTeamAdmin}
            />
          </Flex>
        </StyledPanelHeader>
        {renderMembers()}
      </Panel>
      <Pagination pageLinks={teamMembersPageLinks} />
    </Fragment>
  );
}

const StyledUserListElement = styled('div')`
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: ${space(0.5)};
  align-items: center;
`;

const StyledNameOrEmail = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  ${p => p.theme.overflowEllipsis};
`;

const StyledAvatar = styled(props => <UserAvatar {...props} />)`
  min-width: 1.75em;
  min-height: 1.75em;
  width: 1.5em;
  height: 1.5em;
`;

const StyledMembersLabel = styled('div')`
  display: grid;
  grid-template-columns: 1fr max-content;
  padding: ${space(1)} 0;
  font-size: ${p => p.theme.fontSizeExtraSmall};
  text-transform: uppercase;
`;

const StyledCreateMemberLink = styled(Link)`
  text-transform: none;
`;

const StyledPanelHeader = styled(PanelHeader)`
  ${GRID_TEMPLATE}
`;

export default TeamMembers;
