import {IconSubtract} from '@sentry/icons/subtract';

import {Tag} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {Container} from '@sentry/scraps/layout';

import {IdBadge} from 'sentry/components/idBadge';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {TeamRoleSelect} from 'sentry/components/teamRoleSelect';
import {t} from 'sentry/locale';
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

export function TeamMembersRow({
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
    <SimpleTable.Row>
      <SimpleTable.RowCell gap="md">
        <Container minWidth={0}>
          <IdBadge avatarSize={36} member={member} />
        </Container>
        {member.pending ? <Tag variant="muted">{t('Pending')}</Tag> : null}
      </SimpleTable.RowCell>
      <SimpleTable.RowCell>
        <Container flex="1" minWidth={0}>
          <TeamRoleSelect
            disabled={isSelf || !hasWriteAccess}
            organization={organization}
            team={team}
            member={member}
            onChangeTeamRole={newRole => updateMemberRole({memberId: member.id, newRole})}
            keepMenuInViewport
            menuPortalTarget={document.body}
          />
        </Container>
      </SimpleTable.RowCell>
      <SimpleTable.RowCell justify="end">
        <RemoveButton
          hasWriteAccess={hasWriteAccess}
          isSelf={isSelf}
          onClick={() => removeMember({memberId: member.id})}
          team={team}
          member={member}
        />
      </SimpleTable.RowCell>
    </SimpleTable.Row>
  );
}

function RemoveButton(props: {
  hasWriteAccess: boolean;
  isSelf: boolean;
  member: TeamMember;
  onClick: () => void;
  team: Team;
}) {
  const {member, hasWriteAccess, isSelf, onClick, team} = props;

  const canRemoveMember = hasWriteAccess || isSelf;
  if (!canRemoveMember) {
    return (
      <Button
        size="xs"
        disabled
        icon={<IconSubtract />}
        aria-label={t('Remove')}
        tooltipProps={{
          title: t('You do not have permission to remove a member from this team.'),
        }}
      >
        {t('Remove')}
      </Button>
    );
  }

  const isIdpProvisioned = team.flags['idp:provisioned'];
  const buttonHelpText = getButtonHelpText(isIdpProvisioned);

  const buttonRemoveText = isSelf ? t('Leave') : t('Remove');
  return (
    <Button
      data-test-id={`button-remove-${member.id}`}
      size="xs"
      disabled={!canRemoveMember || isIdpProvisioned}
      icon={<IconSubtract />}
      onClick={onClick}
      aria-label={buttonRemoveText}
      tooltipProps={{title: buttonHelpText}}
    >
      {buttonRemoveText}
    </Button>
  );
}
