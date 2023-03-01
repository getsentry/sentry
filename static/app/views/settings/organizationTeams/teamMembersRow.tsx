import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import IdBadge from 'sentry/components/idBadge';
import {PanelItem} from 'sentry/components/panels';
import RoleSelectControl from 'sentry/components/roleSelectControl';
import {IconSubtract} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Member, Organization, TeamMember, User} from 'sentry/types';
import {
  hasOrgRoleOverwrite,
  RoleOverwriteIcon,
} from 'sentry/views/settings/organizationTeams/roleOverwriteWarning';

const TeamMembersRow = (props: {
  hasWriteAccess: boolean;
  member: TeamMember;
  organization: Organization;
  removeMember: (member: Member) => void;
  updateMemberRole: (member: Member, newRole: string) => void;
  user: User;
}) => {
  const {organization, member, user, hasWriteAccess, removeMember, updateMemberRole} =
    props;

  return (
    <TeamRolesPanelItem key={member.id}>
      <div>
        <IdBadge avatarSize={36} member={member} useLink orgId={organization.slug} />
      </div>
      <div>
        <TeamRoleSelect
          hasWriteAccess={hasWriteAccess}
          updateMemberRole={updateMemberRole}
          organization={organization}
          member={member}
        />
      </div>
      <div>
        <RemoveButton
          hasWriteAccess={hasWriteAccess}
          onClick={() => removeMember(member)}
          member={member}
          user={user}
        />
      </div>
    </TeamRolesPanelItem>
  );
};

const TeamRoleSelect = (props: {
  hasWriteAccess: boolean;
  member: TeamMember;
  organization: Organization;
  updateMemberRole: (member: TeamMember, newRole: string) => void;
}) => {
  const {hasWriteAccess, organization, member, updateMemberRole} = props;
  const {orgRoleList, teamRoleList, features} = organization;
  if (!features.includes('team-roles')) {
    return null;
  }

  const {allOrgRoles: memberOrgRoles} = member;
  const topOrgRole = memberOrgRoles[0];

  const teamRoleId = member.teamRole || topOrgRole.minimumTeamRole;
  const teamRole = teamRoleList.find(r => r.id === teamRoleId) || teamRoleList[0];

  if (
    !hasWriteAccess ||
    hasOrgRoleOverwrite({orgRole: topOrgRole.id, orgRoleList, teamRoleList})
  ) {
    return (
      <RoleName>
        {teamRole.name}
        <IconWrapper>
          <RoleOverwriteIcon
            orgRole={topOrgRole.id}
            orgRoleList={orgRoleList}
            teamRoleList={teamRoleList}
          />
        </IconWrapper>
      </RoleName>
    );
  }

  return (
    <RoleSelectWrapper>
      <RoleSelectControl
        roles={teamRoleList}
        value={teamRole.id}
        onChange={option => updateMemberRole(member, option.value)}
        disableUnallowed
      />
    </RoleSelectWrapper>
  );
};

const RemoveButton = (props: {
  hasWriteAccess: boolean;
  member: TeamMember;
  onClick: () => void;
  user: User;
}) => {
  const {member, user, hasWriteAccess, onClick} = props;

  const isSelf = member.email === user.email;
  const canRemoveMember = hasWriteAccess || isSelf;
  if (!canRemoveMember) {
    return null;
  }

  if (member.flags['idp:provisioned']) {
    return (
      <Button
        size="xs"
        disabled
        icon={<IconSubtract size="xs" isCircled />}
        onClick={onClick}
        aria-label={t('Remove')}
        title={t(
          "Membership to this team is managed through your organization's identity provider."
        )}
      >
        {t('Remove')}
      </Button>
    );
  }

  return (
    <Button
      size="xs"
      disabled={!canRemoveMember}
      icon={<IconSubtract size="xs" isCircled />}
      onClick={onClick}
      aria-label={t('Remove')}
    >
      {t('Remove')}
    </Button>
  );
};

const RoleName = styled('div')`
  display: flex;
  align-items: center;
`;
const IconWrapper = styled('div')`
  height: ${space(2)};
  margin-left: ${space(1)};
`;

const RoleSelectWrapper = styled('div')`
  display: flex;
  flex-direction: row;
  align-items: center;

  > div:first-child {
    flex-grow: 1;
  }
`;

const TeamRolesPanelItem = styled(PanelItem)`
  display: grid;
  grid-template-columns: minmax(120px, 4fr) minmax(120px, 2fr) minmax(100px, 1fr);
  gap: ${space(2)};
  align-items: center;

  > div:last-child {
    margin-left: auto;
  }
`;

export default TeamMembersRow;
