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

import ListTeam from './listTeam';
import Dashboard from './dashboard';

const TAB_DASHBOARD = 'TAB_DASHBOARD';
const TAB_ALL_TEAM = 'TAB_ALL_TEAM';
const TAB_MY_TEAMS = 'TAB_MY_TEAM';

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
  // XXX: Tabs should be managed by react-router but this is easier for Hackweek
  currentTab: typeof TAB_DASHBOARD | typeof TAB_ALL_TEAM | typeof TAB_MY_TEAMS;
};

class TeamsDashboard extends React.Component<Props, State> {
  state: State = {
    currentTab: TAB_DASHBOARD,
  };

  handleCreateTeam = () => {
    const {organization} = this.props;
    openCreateTeamModal({organization});
  };

  renderHeader() {
    const {organization, location, params, routes} = this.props;
    const {currentTab} = this.state;

    const hasTeamAdminAccess = organization.access.includes('project:admin');
    const baseUrl = recreateRoute('', {location, routes, params, stepBack: -1});
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
            isActive={() => currentTab === TAB_DASHBOARD}
            onClick={() => this.setState({currentTab: TAB_DASHBOARD})}
          >
            {t('Dashboard')}
          </ListLink>
          <ListLink
            to={baseUrl}
            index
            isActive={() => currentTab === TAB_ALL_TEAM}
            onClick={() => this.setState({currentTab: TAB_ALL_TEAM})}
          >
            {t('All Teams')}
          </ListLink>
          <ListLink
            to={`${baseUrl}my-teams/`}
            isActive={() => currentTab === TAB_MY_TEAMS}
            onClick={() => this.setState({currentTab: TAB_MY_TEAMS})}
          >
            {t('My Teams')}
          </ListLink>
        </NavTabs>
      </React.Fragment>
    );
  }

  renderContent() {
    const {currentTab} = this.state;

    switch (currentTab) {
      case TAB_DASHBOARD:
        return <Dashboard />;
      case TAB_ALL_TEAM:
      case TAB_MY_TEAMS:
        return (
          <ListTeam {...(this.props as any)} handleCreateTeam={this.handleCreateTeam} />
        );
      default:
        return <div>This should not happen</div>;
    }
  }

  render() {
    const {organization, isLoading} = this.props;

    return (
      <React.Fragment>
        <SentryDocumentTitle title={t('Teams Dashboard')} objSlug={organization.slug} />
        <PageContent>
          {this.renderHeader()}
          {isLoading ? <LoadingIndicator /> : this.renderContent()}
        </PageContent>
      </React.Fragment>
    );
  }
}

export default withOrganization(withTeams(TeamsDashboard));
