import React from 'react';
import {RouteComponentProps} from 'react-router/lib/Router';
import {Location} from 'history';

import {openCreateTeamModal} from 'app/actionCreators/modal';
import Button from 'app/components/button';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';
import ListLink from 'app/components/links/listLink';
import NavTabs from 'app/components/navTabs';
import LoadingIndicator from 'app/components/loadingIndicator';
import PageHeading from 'app/components/pageHeading';
import {IconAdd} from 'app/icons';
import {t} from 'app/locale';
import {PageContent, PageHeader} from 'app/styles/organization';
import {Organization, Team} from 'app/types';
import withOrganization from 'app/utils/withOrganization';
import recreateRoute from 'app/utils/recreateRoute';
import withTeams from 'app/utils/withTeams';

import TabListTeam from './tabListTeam';
import TabDashboard from './tabDashboard';
import {TAB} from './utils';

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

type State = {
  currentTab: TAB;
};

class TeamsTabDashboard extends React.Component<Props, State> {
  state: State = {
    currentTab: TAB.DASHBOARD,
  };

  componentDidMount() {
    this.getCurrentTab();
  }

  getCurrentTab() {
    const {location} = this.props;

    const pathname = location.pathname;

    if (pathname.endsWith('all-teams/')) {
      this.setState({currentTab: TAB.ALL_TEAMS});
      return;
    }

    if (pathname.endsWith('my-teams/')) {
      this.setState({currentTab: TAB.MY_TEAMS});
      return;
    }

    this.setState({currentTab: TAB.DASHBOARD});
  }

  handleCreateTeam = () => {
    const {organization} = this.props;
    openCreateTeamModal({organization});
  };

  renderHeader() {
    const {organization, location, params, routes} = this.props;
    const {currentTab} = this.state;

    const hasTeamAdminAccess = organization.access.includes('project:admin');
    const stepBack =
      location.pathname.endsWith('all-teams/') || location.pathname.endsWith('my-teams/')
        ? -2
        : -1;
    const baseUrl = recreateRoute('', {location, routes, params, stepBack});
    const createTeamLabel = t('Create Team');

    return (
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
            onClick={this.handleCreateTeam}
            icon={<IconAdd size="xs" isCircled />}
          >
            {createTeamLabel}
          </Button>
        </PageHeader>

        <NavTabs underlined>
          <ListLink
            to={baseUrl}
            index
            isActive={() => currentTab === TAB.DASHBOARD}
            onClick={() => this.setState({currentTab: TAB.DASHBOARD})}
          >
            {t('Dashboard')}
          </ListLink>
          <ListLink
            to={`${baseUrl}all-teams/`}
            isActive={() => currentTab === TAB.ALL_TEAMS}
            onClick={() => this.setState({currentTab: TAB.ALL_TEAMS})}
          >
            {t('All Teams')}
          </ListLink>
          <ListLink
            to={`${baseUrl}my-teams/`}
            isActive={() => currentTab === TAB.MY_TEAMS}
            onClick={() => this.setState({currentTab: TAB.MY_TEAMS})}
          >
            {t('My Teams')}
          </ListLink>
        </NavTabs>
      </React.Fragment>
    );
  }

  renderContent() {
    const {currentTab} = this.state;
    const {teams, organization, location} = this.props;

    switch (currentTab) {
      case TAB.DASHBOARD:
        return <TabDashboard />;
      case TAB.ALL_TEAMS:
        return (
          <TabListTeam
            handleCreateTeam={this.handleCreateTeam}
            teams={teams}
            organization={organization}
            location={location}
          />
        );
      case TAB.MY_TEAMS:
        return (
          <TabListTeam
            handleCreateTeam={this.handleCreateTeam}
            teams={teams.filter(team => team.isMember)}
            organization={organization}
            location={location}
          />
        );
      default:
        return <div>This should not happen</div>;
    }
  }

  render() {
    const {organization, isLoading} = this.props;

    return (
      <React.Fragment>
        <SentryDocumentTitle
          title={t('Teams TabDashboard')}
          objSlug={organization.slug}
        />
        <PageContent>
          {this.renderHeader()}
          {isLoading ? <LoadingIndicator /> : this.renderContent()}
        </PageContent>
      </React.Fragment>
    );
  }
}

export default withOrganization(withTeams(TeamsTabDashboard));
