import {Fragment, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import {keepPreviousData} from '@tanstack/react-query';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {
  openInviteMembersModal,
  openTeamAccessRequestModal,
} from 'sentry/actionCreators/modal';
import {joinTeamPromise, leaveTeamPromise} from 'sentry/actionCreators/teams';
import {hasEveryAccess} from 'sentry/components/acl/access';
import {Flex} from 'sentry/components/container/flex';
import {UserAvatar} from 'sentry/components/core/avatar/userAvatar';
import {CompactSelect, type SelectOption} from 'sentry/components/core/compactSelect';
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
import {space} from 'sentry/styles/space';
import type {Member, Organization, Team, TeamMember} from 'sentry/types/organization';
import {
  type ApiQueryKey,
  setApiQueryData,
  useApiQuery,
  useMutation,
  useQueryClient,
} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {useUser} from 'sentry/utils/useUser';
import TextBlock from 'sentry/views/settings/components/text/textBlock';
import TeamMembersRow, {
  GRID_TEMPLATE,
} from 'sentry/views/settings/organizationTeams/teamMembersRow';
import {ProjectPermissionAlert} from 'sentry/views/settings/project/projectPermissionAlert';

import {getButtonHelpText} from './utils';

interface TeamMembersProps {
  team: Team;
}

function getTeamMembersQueryKey({
  organization,
  teamId,
  location,
}: {
  location: ReturnType<typeof useLocation>;
  organization: Organization;
  teamId: string;
}): ApiQueryKey {
  return [
    `/teams/${organization.slug}/${teamId}/members/`,
    {
      query: {
        cursor: location.query.cursor,
        query: location.query.query,
      },
    },
  ];
}

function AddMemberDropdown({
  teamMembers,
  organization,
  team,
  teamId,
  isTeamAdmin,
  onAddMember,
}: {
  isTeamAdmin: boolean;
  onAddMember: (variables: {orgMember: TeamMember}) => void;
  organization: Organization;
  team: Team;
  teamId: string;
  teamMembers: TeamMember[];
}) {
  const [memberQuery, setMemberQuery] = useState('');
  const debouncedMemberQuery = useDebouncedValue(memberQuery, 50);
  const {data: orgMembers = [], isFetching: isOrgMembersFetching} = useApiQuery<Member[]>(
    [
      `/organizations/${organization.slug}/members/`,
      {
        query: debouncedMemberQuery ? {query: debouncedMemberQuery} : undefined,
      },
    ],
    {
      staleTime: 30_000,
      placeholderData: keepPreviousData,
    }
  );

  // members can add other members to a team if the `Open Membership` setting is enabled
  // otherwise, `org:write` or `team:admin` permissions are required
  const hasOpenMembership = !!organization?.openMembership;
  const canAddMembers = hasOpenMembership || isTeamAdmin;

  const isDropdownDisabled = team.flags['idp:provisioned'];

  const addTeamMember = (selection: SelectOption<string>) => {
    const orgMember = orgMembers.find(member => member.id === selection.value);
    if (orgMember === undefined) {
      return;
    }

    // Reset members list after adding member to team
    setMemberQuery('');
    onAddMember({orgMember});
  };

  const items = useMemo(() => {
    const existingMembers = new Set(teamMembers.map(member => member.id));
    return (orgMembers || [])
      .filter(m => !existingMembers.has(m.id))
      .map(
        m =>
          ({
            textValue: `${m.name} ${m.email}`,
            value: m.id,
            label: (
              <StyledUserListElement>
                <UserAvatar
                  user={{
                    id: m.user?.id ?? m.id,
                    name: m.user?.name ?? m.name,
                    email: m.user?.email ?? m.email,
                    avatar: m.user?.avatar ?? undefined,
                    avatarUrl: m.user?.avatarUrl ?? undefined,
                    type: 'user',
                  }}
                  title={m.user?.name ?? m.name ?? m.user?.email ?? m.email}
                  size={24}
                  className="avatar"
                />
                <StyledNameOrEmail>{m.name || m.email}</StyledNameOrEmail>
              </StyledUserListElement>
            ),
          }) satisfies SelectOption<string>
      );
  }, [teamMembers, orgMembers]);

  return (
    <CompactSelect
      size="xs"
      menuWidth={250}
      options={items}
      onClose={() => setMemberQuery('')}
      onChange={
        canAddMembers
          ? addTeamMember
          : selection =>
              openTeamAccessRequestModal({
                teamId,
                orgId: organization.slug,
                memberId: selection.value,
              })
      }
      menuHeaderTrailingItems={
        <StyledCreateMemberLink
          to=""
          onClick={() => openInviteMembersModal({source: 'teams'})}
          data-test-id="invite-member"
        >
          {t('Invite Member')}
        </StyledCreateMemberLink>
      }
      data-test-id="add-member-menu"
      disabled={isDropdownDisabled}
      menuTitle={t('Members')}
      triggerLabel={t('Add Member')}
      searchPlaceholder={t('Search Members')}
      emptyMessage={t('No members')}
      loading={isOrgMembersFetching}
      searchable
      disableSearchFilter
      /**
       * We perform an API request to support orgs with > 100 members (since that's the max API returns)
       */
      onSearch={setMemberQuery}
    />
  );
}

function TeamMembers({team}: TeamMembersProps) {
  const user = useUser();
  const api = useApi({persistInFlight: true});
  const queryClient = useQueryClient();
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
    getTeamMembersQueryKey({organization, teamId, location}),
    {
      staleTime: 30_000,
    }
  );

  const teamMembersPageLinks = getTeamMemberResponseHeader?.('Link');

  const hasOrgWriteAccess = hasEveryAccess(['org:write'], {organization, team});
  const hasTeamAdminAccess = hasEveryAccess(['team:admin'], {organization, team});
  const isTeamAdmin = hasOrgWriteAccess || hasTeamAdminAccess;

  const {mutate: handleRemoveTeamMember} = useMutation({
    mutationFn: ({memberId}: {memberId: string}) => {
      return leaveTeamPromise(api, {
        orgId: organization.slug,
        teamId,
        memberId,
      });
    },
    onSuccess: (_data, variables) => {
      setApiQueryData<TeamMember[]>(
        queryClient,
        getTeamMembersQueryKey({organization, teamId, location}),
        existingData => {
          if (!existingData) {
            return existingData;
          }
          return existingData.filter(member => member.id !== variables.memberId);
        }
      );
      addSuccessMessage(t('Successfully removed member from team.'));
    },
    onError: () => {
      addErrorMessage(
        t('There was an error while trying to remove a member from the team.')
      );
    },
  });

  const {mutate: updateTeamMemberRole} = useMutation({
    mutationFn: ({memberId, newRole}: {memberId: string; newRole: string}) => {
      return api.requestPromise(
        `/organizations/${organization.slug}/members/${memberId}/teams/${teamId}/`,
        {
          method: 'PUT',
          data: {teamRole: newRole},
        }
      );
    },
    onSuccess: (_data, variables) => {
      addSuccessMessage(t('Successfully changed role for team member.'));
      setApiQueryData<TeamMember[]>(
        queryClient,
        getTeamMembersQueryKey({organization, teamId, location}),
        existingData => {
          if (!existingData) {
            return existingData;
          }

          return existingData.map(member => {
            if (member.id === variables.memberId) {
              return {
                ...member,
                teamRole: variables.newRole,
              };
            }

            return member;
          });
        }
      );
    },
    onError: () => {
      addErrorMessage(
        t('There was an error while trying to change the roles for a team member.')
      );
    },
  });

  const {mutate: handleAddTeamMember} = useMutation({
    mutationFn: ({orgMember}: {orgMember: TeamMember}) => {
      return joinTeamPromise(api, {
        orgId: organization.slug,
        teamId,
        memberId: orgMember.id,
      });
    },
    onSuccess: (_data, {orgMember}) => {
      setApiQueryData<TeamMember[]>(
        queryClient,
        getTeamMembersQueryKey({organization, teamId, location}),
        existingData => {
          if (!existingData) {
            return existingData;
          }
          return existingData.concat([orgMember]);
        }
      );
      addSuccessMessage(t('Successfully added member to team.'));
    },
    onError: () => {
      addErrorMessage(t('Unable to add team member.'));
    },
  });

  if (isTeamMembersError) {
    return <LoadingError onRetry={refetchTeamMembers} />;
  }

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
            user={user}
            removeMember={handleRemoveTeamMember}
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

      <ProjectPermissionAlert
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
              onAddMember={handleAddTeamMember}
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
  text-transform: initial;
  font-weight: normal;
`;

const StyledNameOrEmail = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  ${p => p.theme.overflowEllipsis};
`;

const StyledCreateMemberLink = styled(Link)`
  text-transform: initial;
`;

const StyledPanelHeader = styled(PanelHeader)`
  ${GRID_TEMPLATE}
`;

export default TeamMembers;
