import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import IdBadge from 'sentry/components/idBadge';
import PanelItem from 'sentry/components/panels/panelItem';
import TeamRoleSelect from 'sentry/components/teamRoleSelect';
import {IconSubtract} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Member, Organization, Team, TeamMember, User} from 'sentry/types';
import {getButtonHelpText} from 'sentry/views/settings/organizationTeams/utils';

interface Props {
  hasWriteAccess: boolean;
  isOrgOwner: boolean;
  member: TeamMember;
  organization: Organization;
  removeMember: (member: Member) => void;
  team: Team;
  updateMemberRole: (member: Member, newRole: string) => void;
  user: User;
}

function TeamMembersRow({
  organization,
  team,
  member,
  user,
  hasWriteAccess,
  isOrgOwner,
  removeMember,
  updateMemberRole,
}: Props) {
  const isSelf = user.email === member.email;

  return (
    <TeamRolesPanelItem key={member.id}>
      <div>
        <IdBadge avatarSize={36} member={member} useLink orgId={organization.slug} />
      </div>
      <RoleSelectWrapper>
        <TeamRoleSelect
          disabled={isSelf || !hasWriteAccess}
          organization={organization}
          team={team}
          member={member}
          onChangeTeamRole={newRole => updateMemberRole(member, newRole)}
        />
      </RoleSelectWrapper>
      <div>
        <RemoveButton
          hasWriteAccess={hasWriteAccess}
          hasOrgRoleFromTeam={!!team.orgRole}
          isOrgOwner={isOrgOwner}
          isSelf={isSelf}
          onClick={() => removeMember(member)}
          member={member}
        />
      </div>
    </TeamRolesPanelItem>
  );
}

function RemoveButton(props: {
  hasOrgRoleFromTeam: boolean;
  hasWriteAccess: boolean;
  isOrgOwner: boolean;
  isSelf: boolean;
  member: TeamMember;
  onClick: () => void;
}) {
  const {member, hasWriteAccess, isOrgOwner, isSelf, hasOrgRoleFromTeam, onClick} = props;

  const canRemoveMember = hasWriteAccess || isSelf;
  if (!canRemoveMember) {
    return (
      <Button
        size="xs"
        disabled
        icon={<IconSubtract isCircled />}
        aria-label={t('Remove')}
        title={t('You do not have permission to remove a member from this team.')}
      >
        {t('Remove')}
      </Button>
    );
  }

  const isIdpProvisioned = member.flags['idp:provisioned'];
  const isPermissionGroup = hasOrgRoleFromTeam && !isOrgOwner;
  const buttonHelpText = getButtonHelpText(isIdpProvisioned, isPermissionGroup);
  if (isIdpProvisioned || isPermissionGroup) {
    return (
      <Button
        size="xs"
        disabled
        icon={<IconSubtract isCircled />}
        aria-label={t('Remove')}
        title={buttonHelpText}
      >
        {t('Remove')}
      </Button>
    );
  }

  const buttonRemoveText = isSelf ? t('Leave') : t('Remove');
  return (
    <Button
      data-test-id={`button-remove-${member.id}`}
      size="xs"
      disabled={!canRemoveMember}
      icon={<IconSubtract isCircled />}
      onClick={onClick}
      aria-label={buttonRemoveText}
    >
      {buttonRemoveText}
    </Button>
  );
}

const RoleSelectWrapper = styled('div')`
  display: flex;
  flex-direction: row;
  align-items: center;

  > div:first-child {
    flex-grow: 1;
  }
`;

export const GRID_TEMPLATE = `
  display: grid;
  grid-template-columns: minmax(100px, 1fr) 200px 150px;
  gap: ${space(1)};
`;

const TeamRolesPanelItem = styled(PanelItem)`
  ${GRID_TEMPLATE};
  align-items: center;

  > div:last-child {
    margin-left: auto;
  }
`;

export default TeamMembersRow;
