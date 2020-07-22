import React from 'react';
import {RouteComponentProps} from 'react-router/lib/Router';
import {Location} from 'history';
import styled from '@emotion/styled';

import EmptyMessage from 'app/views/settings/components/emptyMessage';
import {openCreateTeamModal} from 'app/actionCreators/modal';
import Button from 'app/components/button';
import {t} from 'app/locale';
import withOrganization from 'app/utils/withOrganization';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';
import PageHeading from 'app/components/pageHeading';
import {Organization, Team} from 'app/types';
import {IconAdd, IconFile} from 'app/icons';
import ListLink from 'app/components/links/listLink';
import NavTabs from 'app/components/navTabs';
import recreateRoute from 'app/utils/recreateRoute';
import {PageContent, PageHeader} from 'app/styles/organization';
import withTeams from 'app/utils/withTeams';
import space from 'app/styles/space';
import LoadingIndicator from 'app/components/loadingIndicator';

import TeamCard from './teamCard';

type Props = RouteComponentProps<
  {orgId: string; projectId: string; location: Location},
  {}
> & {
  organization: Organization;
  location: Location;
  params: Record<string, string | undefined>;
  teams: Array<Team>;
  isLoading: boolean;
};

const TeamsDashboard = ({
  organization,
  routes,
  location,
  params,
  teams,
  isLoading,
}: Props) => {
  const access = new Set(organization.access);
  const hasTeamAdminAccess = access.has('project:admin');
  const displayMyTeams = location.pathname.endsWith('my-teams/');
  const baseUrl = recreateRoute('', {location, routes, params, stepBack: -1});

  const displayTeams = displayMyTeams ? teams.filter(team => team.isMember) : teams;
  const createTeamLabel = t('Create Team');

  const handleCreateTeam = () => {
    openCreateTeamModal({organization});
  };

  const renderContent = () => (
    <React.Fragment>
      <PageHeader>
        <PageHeading>{t('Teams')}</PageHeading>
        <Button
          size="small"
          disabled={!hasTeamAdminAccess}
          title={
            !hasTeamAdminAccess
              ? t('You do not have permission to create teams')
              : undefined
          }
          onClick={handleCreateTeam}
          icon={<IconAdd size="xs" isCircled />}
        >
          {createTeamLabel}
        </Button>
      </PageHeader>
      {displayTeams.length > 0 ? (
        <React.Fragment>
          <NavTabs underlined>
            <ListLink to={baseUrl} index isActive={() => !displayMyTeams}>
              {t('All Teams')}
            </ListLink>
            <ListLink to={`${baseUrl}my-teams/`} isActive={() => displayMyTeams}>
              {t('My Teams')}
            </ListLink>
          </NavTabs>
          <Content>
            {displayTeams.map(displayTeam => (
              <TeamCard
                key={displayTeam.id}
                hasTeamAdminAccess={hasTeamAdminAccess}
                organization={organization}
                team={displayTeam}
              />
            ))}
          </Content>
        </React.Fragment>
      ) : (
        <EmptyMessage
          size="large"
          title={t('No teams have been created yet.')}
          icon={<IconFile size="xl" />}
          action={
            <Button
              size="small"
              disabled={!hasTeamAdminAccess}
              title={
                !hasTeamAdminAccess
                  ? t('You do not have permission to create teams')
                  : undefined
              }
              onClick={handleCreateTeam}
              icon={<IconAdd size="xs" isCircled />}
            >
              {createTeamLabel}
            </Button>
          }
        />
      )}
    </React.Fragment>
  );

  return (
    <React.Fragment>
      <SentryDocumentTitle title={t('Teams Dashboard')} objSlug={organization.slug} />
      <PageContent>{isLoading ? <LoadingIndicator /> : renderContent()}</PageContent>
    </React.Fragment>
  );
};

export default withOrganization(withTeams(TeamsDashboard));

const Content = styled('div')`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  grid-gap: ${space(3)};
`;
