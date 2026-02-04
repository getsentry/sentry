import {useMemo} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import InteractionStateLayer from '@sentry/scraps/interactionStateLayer';
import {Link} from '@sentry/scraps/link';

import {openCreateTeamModal} from 'sentry/actionCreators/modal';
import IdBadge from 'sentry/components/idBadge';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {t, tct, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Team} from 'sentry/types/organization';
import useMedia from 'sentry/utils/useMedia';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {useLeaveTeam} from 'sentry/views/settings/organizationTeams/hooks/useTeamMembership';
import {RoleOverwritePanelAlert} from 'sentry/views/settings/organizationTeams/roleOverwriteWarning';
import {TeamProjectsCell} from 'sentry/views/settings/organizationTeams/teamProjectsCell';
import {getButtonHelpText} from 'sentry/views/settings/organizationTeams/utils';

interface YourTeamsTableProps {
  allTeamsCount: number;
  canCreateTeams: boolean;
  hasSearch: boolean;
  initiallyLoaded: boolean;
  teams: Team[];
}

export function YourTeamsTable({
  teams,
  initiallyLoaded,
  canCreateTeams,
  hasSearch,
  allTeamsCount,
}: YourTeamsTableProps) {
  const organization = useOrganization();
  const {orgRole, orgRoleList, teamRoleList} = organization;
  const {projects} = useProjects();

  const renderEmptyState = () => {
    if (hasSearch) {
      return <SimpleTable.Empty>{t('No teams match your search.')}</SimpleTable.Empty>;
    }

    if (allTeamsCount === 0) {
      return (
        <SimpleTable.Empty>
          {t('No teams have been created yet.')}{' '}
          {canCreateTeams &&
            tct('Get started by [link:creating your first team].', {
              link: (
                <Button
                  priority="link"
                  onClick={() => openCreateTeamModal({organization})}
                  aria-label={t('Create team')}
                />
              ),
            })}
        </SimpleTable.Empty>
      );
    }

    return (
      <SimpleTable.Empty>
        {t("You haven't joined any teams yet.")}{' '}
        {canCreateTeams &&
          tct('You can always [link:create one].', {
            link: (
              <Button
                priority="link"
                onClick={() => openCreateTeamModal({organization})}
                aria-label={t('Create team')}
              />
            ),
          })}
      </SimpleTable.Empty>
    );
  };

  return (
    <StyledSimpleTable>
      <SimpleTable.Header>
        <SimpleTable.HeaderCell>{t('Your Teams')}</SimpleTable.HeaderCell>
        <SimpleTable.HeaderCell data-column-name="role">
          {t('Role')}
        </SimpleTable.HeaderCell>
        <SimpleTable.HeaderCell data-column-name="projects">
          {t('Projects')}
        </SimpleTable.HeaderCell>
        <SimpleTable.HeaderCell />
      </SimpleTable.Header>
      <FullWidthAlert>
        <RoleOverwritePanelAlert
          orgRole={orgRole}
          orgRoleList={orgRoleList}
          teamRoleList={teamRoleList}
          isSelf
        />
      </FullWidthAlert>
      {initiallyLoaded ? (
        teams.length === 0 ? (
          renderEmptyState()
        ) : (
          teams.map(team => (
            <YourTeamRow key={team.slug} team={team} projects={projects} />
          ))
        )
      ) : (
        <SimpleTable.Row>
          <LoadingCell>
            <LoadingIndicator />
          </LoadingCell>
        </SimpleTable.Row>
      )}
    </StyledSimpleTable>
  );
}

function YourTeamRow({
  team,
  projects,
}: {
  projects: ReturnType<typeof useProjects>['projects'];
  team: Team;
}) {
  const organization = useOrganization();
  const theme = useTheme();
  const isMobile = useMedia(`(max-width: ${theme.breakpoints.sm})`);

  const {mutate: leaveTeam, isPending} = useLeaveTeam({organization, team});

  const teamRoleName = useMemo(() => {
    return organization.teamRoleList.find(r => r.id === team.teamRole)?.name;
  }, [organization.teamRoleList, team.teamRole]);

  const teamProjects = useMemo(() => {
    return projects.filter(p => p.teams.some(tm => tm.slug === team.slug));
  }, [projects, team.slug]);

  const isIdpProvisioned = team.flags['idp:provisioned'];
  const buttonHelpText = getButtonHelpText(isIdpProvisioned);
  const canViewTeam = team.hasAccess;

  const badge = (
    <IdBadge
      team={team}
      avatarSize={36}
      description={tn('%s Member', '%s Members', team.memberCount)}
    />
  );

  return (
    <SimpleTable.Row>
      {canViewTeam && <InteractionStateLayer />}
      <SimpleTable.RowCell>
        {canViewTeam ? (
          <TeamLink
            data-test-id="team-link"
            to={`/settings/${organization.slug}/teams/${team.slug}/`}
          >
            {badge}
          </TeamLink>
        ) : (
          badge
        )}
      </SimpleTable.RowCell>
      <SimpleTable.RowCell data-column-name="role">
        {teamRoleName ?? null}
      </SimpleTable.RowCell>
      <SimpleTable.RowCell data-column-name="projects">
        <TeamProjectsCell
          projects={teamProjects}
          teamProjectsUrl={`/settings/${organization.slug}/teams/${team.slug}/projects/`}
        />
      </SimpleTable.RowCell>
      <SimpleTable.RowCell justify="end">
        {isPending ? (
          <Button size="sm" disabled>
            ...
          </Button>
        ) : (
          <Button
            aria-label={t('Leave Team')}
            size={isMobile ? 'xs' : 'sm'}
            onClick={() => leaveTeam()}
            disabled={isIdpProvisioned}
            title={buttonHelpText}
          >
            {t('Leave Team')}
          </Button>
        )}
      </SimpleTable.RowCell>
    </SimpleTable.Row>
  );
}

const StyledSimpleTable = styled(SimpleTable)`
  grid-template-columns: 1fr 125px 150px 130px;
  margin-bottom: ${space(2)};

  @media (max-width: ${p => p.theme.breakpoints.md}) {
    grid-template-columns: 1fr 125px 130px;

    [data-column-name='projects'] {
      display: none;
    }
  }

  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    grid-template-columns: 1fr auto;

    [data-column-name='role'] {
      display: none;
    }
  }
`;

const TeamLink = styled(Link)`
  ${SimpleTable.rowLinkStyle}
`;

const LoadingCell = styled('div')`
  grid-column: 1 / -1;
  display: flex;
  justify-content: center;
  padding: ${space(4)};
`;

const FullWidthAlert = styled('div')`
  grid-column: 1 / -1;
`;
