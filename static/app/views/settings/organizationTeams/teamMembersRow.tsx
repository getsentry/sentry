import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import IdBadge from 'sentry/components/idBadge';
import PanelItem from 'sentry/components/panels/panelItem';
import TeamRoleSelect from 'sentry/components/teamRoleSelect';
import {IconSubtract} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization, Team, TeamMember} from 'sentry/types/organization';
import type {User} from 'sentry/types/user';
import {getButtonHelpText} from 'sentry/views/settings/organizationTeams/utils';

interface Props {
  hasWriteAccess: boolean;
  member: TeamMember;
  organization: Organization;
  removeMember: (variables: {memberId: string}) => void;
  team: Team;
  updateMemberRole: (variables: {memberId: string; newRole: string}) => void;
  user: User;
}

function TeamMembersRow({
  organization,
  team,
  member,
  user,
  hasWriteAccess,
  removeMember,
  updateMemberRole,
}: Props) {
  const isSelf = user.email === member.email;

  return (
    <TeamRolesPanelItem key={member.id}>
      <div>
        <IdBadge avatarSize={36} member={member} />
      </div>
      <RoleSelectWrapper>
        <TeamRoleSelect
          disabled={isSelf || !hasWriteAccess}
          organization={organization}
          team={team}
          member={member}
          onChangeTeamRole={newRole => updateMemberRole({memberId: member.id, newRole})}
        />
      </RoleSelectWrapper>
      <div>
        <RemoveButton
          hasWriteAccess={hasWriteAccess}
          isSelf={isSelf}
          onClick={() => removeMember({memberId: member.id})}
          member={member}
        />
      </div>
    </TeamRolesPanelItem>
  );
}

function RemoveButton(props: {
  hasWriteAccess: boolean;
  isSelf: boolean;
  member: TeamMember;
  onClick: () => void;
}) {
  const {member, hasWriteAccess, isSelf, onClick} = props;

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
  const buttonHelpText = getButtonHelpText(isIdpProvisioned);

  const buttonRemoveText = isSelf ? t('Leave') : t('Remove');
  return (
    <Button
      data-test-id={`button-remove-${member.id}`}
      size="xs"
      disabled={!canRemoveMember || isIdpProvisioned}
      icon={<IconSubtract isCircled />}
      onClick={onClick}
      aria-label={buttonRemoveText}
      title={buttonHelpText}
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
