import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';
import type {ControlProps} from '@sentry/scraps/select';

import {RoleSelectControl} from 'sentry/components/roleSelectControl';
import type {Organization, Team, TeamMember} from 'sentry/types/organization';
import {
  hasOrgRoleOverwrite,
  RoleOverwriteIcon,
} from 'sentry/views/settings/organizationTeams/roleOverwriteWarning';

interface Props {
  member: TeamMember;
  onChangeTeamRole: (newRole: string) => void;
  organization: Organization;
  team: Team;
  disabled?: boolean;
  size?: ControlProps['size'];
}

export function TeamRoleSelect({
  organization,
  team,
  member,
  onChangeTeamRole,
  disabled,
  size,
}: Props) {
  const {orgRoleList, teamRoleList, features} = organization;
  const hasTeamRoles = features.includes('team-roles');

  const memberOrgRole = orgRoleList.find(r => r.id === member.orgRole);

  // If the member's org-role has elevated permission, their team-role will
  // inherit scopes from it
  if (hasOrgRoleOverwrite({orgRole: memberOrgRole?.id, orgRoleList, teamRoleList})) {
    const effectiveTeamRole = teamRoleList.find(
      r => r.id === memberOrgRole?.minimumTeamRole
    );

    return (
      <Flex align="center">
        {effectiveTeamRole?.name || memberOrgRole?.minimumTeamRole}
        <IconWrapper>
          <RoleOverwriteIcon
            orgRole={memberOrgRole?.id}
            orgRoleList={orgRoleList}
            teamRoleList={teamRoleList}
          />
        </IconWrapper>
      </Flex>
    );
  }

  const teamRoleId =
    member.teamRole || // From TeamMemberEndpoint
    member.teamRoles?.find(tr => tr.teamSlug === team.slug)?.role || // From OrgMemberDetailEndpoint
    null;
  const teamRole = teamRoleList.find(r => r.id === teamRoleId) || teamRoleList[0]!;

  return (
    <RoleSelectControl
      disabled={disabled || !hasTeamRoles}
      disableUnallowed={false}
      roles={teamRoleList}
      value={teamRole.id}
      onChange={option => onChangeTeamRole(option.value)}
      size={size}
    />
  );
}

const IconWrapper = styled('div')`
  height: ${p => p.theme.space.xl};
  margin-left: ${p => p.theme.space.md};
`;
