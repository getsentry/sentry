import styled from '@emotion/styled';

import {ControlProps} from 'sentry/components/forms/controls/selectControl';
import RoleSelectControl from 'sentry/components/roleSelectControl';
import {space} from 'sentry/styles/space';
import {Organization, Team, TeamMember, TeamRole} from 'sentry/types';
import {getEffectiveOrgRole} from 'sentry/utils/orgRole';
import {
  hasOrgRoleOverwrite,
  RoleOverwriteIcon,
} from 'sentry/views/settings/organizationTeams/roleOverwriteWarning';

interface Props {
  member: TeamMember;
  onChangeTeamRole: (newRole: TeamRole['id'] | string) => void;
  organization: Organization;
  team: Team;
  disabled?: boolean;
  size?: ControlProps['size'];
}

function TeamRoleSelect({
  organization,
  team,
  member,
  onChangeTeamRole,
  disabled,
  size,
}: Props) {
  const {orgRoleList, teamRoleList, features} = organization;
  const hasTeamRoles = features.includes('team-roles');

  // Determine the org-role, including if the current team has an org role
  // and adding the user to the current team changes their minimum team-role
  const possibleOrgRoles = [member.orgRole];
  if (member.groupOrgRoles && member.groupOrgRoles.length > 0) {
    possibleOrgRoles.push(member.groupOrgRoles[0].role.id);
  }
  if (team.orgRole) {
    possibleOrgRoles.push(team.orgRole);
  }
  const effectiveOrgRole = getEffectiveOrgRole(possibleOrgRoles, orgRoleList);

  // If the member's org-role has elevated permission, their team-role will
  // inherit scopes from it
  if (hasOrgRoleOverwrite({orgRole: effectiveOrgRole?.id, orgRoleList, teamRoleList})) {
    const effectiveTeamRole = teamRoleList.find(
      r => r.id === effectiveOrgRole?.minimumTeamRole
    );

    return (
      <RoleName>
        {effectiveTeamRole?.name || effectiveOrgRole?.minimumTeamRole}
        <IconWrapper>
          <RoleOverwriteIcon
            orgRole={effectiveOrgRole?.id}
            orgRoleList={orgRoleList}
            teamRoleList={teamRoleList}
          />
        </IconWrapper>
      </RoleName>
    );
  }

  const teamRoleId =
    member.teamRole || // From TeamMemberEndpoint
    member.teamRoles?.find(tr => tr.teamSlug === team.slug)?.role || // From OrgMemberDetailEndpoint
    null;
  const teamRole = teamRoleList.find(r => r.id === teamRoleId) || teamRoleList[0];

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

export default TeamRoleSelect;

const RoleName = styled('div')`
  display: flex;
  align-items: center;
`;
const IconWrapper = styled('div')`
  height: ${space(2)};
  margin-left: ${space(1)};
`;
