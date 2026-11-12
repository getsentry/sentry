import {IconSubtract} from '@sentry/icons/subtract';

import {Button} from '@sentry/scraps/button';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import type {TableColumnConfig} from '@sentry/scraps/table';

import {TeamBadge} from 'sentry/components/idBadge/teamBadge';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {TeamRoleSelect} from 'sentry/components/teamRoleSelect';
import {TeamRoleColumnLabel} from 'sentry/components/teamRoleUtils';
import {t} from 'sentry/locale';
import type {Member, Organization, Team} from 'sentry/types/organization';
import {useTeams} from 'sentry/utils/useTeams';
import {RoleOverwriteAlert} from 'sentry/views/settings/organizationTeams/roleOverwriteWarning';
import {getButtonHelpText} from 'sentry/views/settings/organizationTeams/utils';

import type {TeamSelectProps} from './utils';
import {DropdownAddTeam} from './utils';

const COLUMNS: TableColumnConfig[] = [
  {key: 'team', width: {zero: 'minmax(200px, 1fr)', sm: 'minmax(150px, 1fr)'}},
  {key: 'teamRole', width: {zero: 160, md: 200}},
  {key: 'actions', width: 'max-content'},
];

type Props = TeamSelectProps & {
  /**
   * Member that this component is acting upon
   */
  member: Member;
  /**
   * Used when showing Teams for a Member
   */
  onChangeTeamRole: (teamSlug: string, teamRole: string) => void;
  /**
   * Used when showing Teams for a Member
   */
  selectedOrgRole: Member['orgRole'];
  /**
   * Used when showing Teams for a Member
   */
  selectedTeamRoles: Member['teamRoles'];
};

export function TeamSelect({
  disabled,
  loadingTeams,
  member,
  selectedOrgRole,
  selectedTeamRoles,
  organization,
  onAddTeam,
  onRemoveTeam,
  onCreateTeam,
  onChangeTeamRole,
}: Props) {
  const {teams, onSearch, fetching: isLoadingTeams} = useTeams();

  const selectedTeamSlugs = new Set(selectedTeamRoles.map(tm => tm.teamSlug));
  const selectedTeams = teams.filter(tm => selectedTeamSlugs.has(tm.slug));

  return (
    <Stack gap="md">
      {!loadingTeams && selectedTeams.length > 0 && (
        <RoleOverwriteAlert
          orgRole={selectedOrgRole}
          orgRoleList={organization.orgRoleList}
          teamRoleList={organization.teamRoleList}
        />
      )}
      <SimpleTable
        aria-label={t('Teams')}
        columns={COLUMNS}
        scrollable
        header={
          <SimpleTable.HeaderRow>
            <SimpleTable.HeaderCell>{t('Team')}</SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell>
              <TeamRoleColumnLabel />
            </SimpleTable.HeaderCell>
            <Flex as="th" role="columnheader" align="center" justify="end" padding="0 xl">
              <DropdownAddTeam
                disabled={disabled}
                isLoadingTeams={isLoadingTeams}
                isAddingTeamToMember
                onSearch={onSearch}
                onSelect={onAddTeam}
                onCreateTeam={onCreateTeam}
                organization={organization}
                selectedTeams={selectedTeams.map(tm => tm.slug)}
                teams={teams}
              />
            </Flex>
          </SimpleTable.HeaderRow>
        }
      >
        {loadingTeams ? (
          <SimpleTable.Loading />
        ) : (
          <TeamSelectBody
            disabled={disabled}
            member={member}
            onChangeTeamRole={onChangeTeamRole}
            onRemoveTeam={onRemoveTeam}
            organization={organization}
            selectedOrgRole={selectedOrgRole}
            selectedTeamRoles={selectedTeamRoles}
            selectedTeams={selectedTeams}
          />
        )}
      </SimpleTable>
    </Stack>
  );
}

type TeamSelectBodyProps = {
  disabled: boolean;
  member: Member;
  onChangeTeamRole: Props['onChangeTeamRole'];
  onRemoveTeam: Props['onRemoveTeam'];
  organization: Organization;
  selectedOrgRole: Member['orgRole'];
  selectedTeamRoles: Member['teamRoles'];
  selectedTeams: Team[];
};

function TeamSelectBody({
  disabled,
  member,
  onChangeTeamRole,
  onRemoveTeam,
  organization,
  selectedOrgRole,
  selectedTeamRoles,
  selectedTeams,
}: TeamSelectBodyProps) {
  if (selectedTeams.length === 0) {
    return <SimpleTable.Empty>{t('No Teams assigned')}</SimpleTable.Empty>;
  }

  return selectedTeams.map(team => (
    <TeamRow
      key={team.slug}
      disabled={disabled}
      organization={organization}
      team={team}
      member={{
        ...member,
        orgRole: selectedOrgRole,
        teamRoles: selectedTeamRoles,
      }}
      onChangeTeamRole={onChangeTeamRole}
      onRemoveTeam={slug => onRemoveTeam(slug)}
    />
  ));
}

function TeamRow({
  disabled,
  organization,
  team,
  member,
  onRemoveTeam,
  onChangeTeamRole,
}: {
  disabled: boolean;
  member: Member;
  onChangeTeamRole: Props['onChangeTeamRole'];
  onRemoveTeam: Props['onRemoveTeam'];
  organization: Organization;
  team: Team;
}) {
  const isIdpProvisioned = team.flags['idp:provisioned'];
  const isRemoveDisabled = disabled || isIdpProvisioned;

  const buttonHelpText = getButtonHelpText(isIdpProvisioned);

  return (
    <SimpleTable.Row data-test-id="team-row-for-member">
      <SimpleTable.RowCell>
        <Container minWidth={0}>
          <Link to={`/settings/${organization.slug}/teams/${team.slug}/`}>
            <TeamBadge team={team} />
          </Link>
        </Container>
      </SimpleTable.RowCell>

      <SimpleTable.RowCell>
        <Container flex="1" minWidth={0}>
          <TeamRoleSelect
            disabled={disabled}
            size="xs"
            organization={organization}
            team={team}
            member={member}
            onChangeTeamRole={newRole => onChangeTeamRole(team.slug, newRole)}
            keepMenuInViewport
            menuPortalTarget={document.body}
          />
        </Container>
      </SimpleTable.RowCell>

      <SimpleTable.RowCell justify="end">
        <Button
          size="xs"
          icon={<IconSubtract />}
          tooltipProps={{title: buttonHelpText}}
          disabled={isRemoveDisabled}
          onClick={() => onRemoveTeam(team.slug)}
        >
          {t('Remove')}
        </Button>
      </SimpleTable.RowCell>
    </SimpleTable.Row>
  );
}
