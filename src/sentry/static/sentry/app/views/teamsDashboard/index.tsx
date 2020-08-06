import React from 'react';
import {RouteComponentProps} from 'react-router/lib/Router';
import {Location} from 'history';

import withApi from 'app/utils/withApi';
import {openCreateTeamModal} from 'app/actionCreators/modal';
import Button from 'app/components/button';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';
import ListLink from 'app/components/links/listLink';
import NavTabs from 'app/components/navTabs';
import Badge from 'app/components/badge';
import {IconGroup} from 'app/icons';
import {t} from 'app/locale';
import {PageContent, PageHeader} from 'app/styles/organization';
import {Organization, Team} from 'app/types';
import withOrganization from 'app/utils/withOrganization';
import recreateRoute from 'app/utils/recreateRoute';
import withTeams from 'app/utils/withTeams';
import Breadcrumbs from 'app/components/breadcrumbs';
import {Client} from 'app/api';

import AllTeams from './allTeams';
import MyTeams from './myTeams';
import {TAB, joinTheTeam, leaveTheTeam} from './utils';
import * as LocalStorageContext from './withLocalStorage';

type Props = RouteComponentProps<
  {orgId: string; projectId: string; location: Location},
  {}
> & {
  organization: Organization;
  location: Location;
  params: Record<string, string | undefined>;
  teams: Array<Team>;
  api: Client;
};

type State = {
  currentTab: TAB;
  teams: Array<Team>;
  myTeams: Array<Team>;
};

class TeamsTabDashboard extends React.Component<Props, State> {
  state: State = {
    currentTab: TAB.MY_TEAMS,
    teams: [],
    myTeams: [],
  };

  componentDidMount() {
    this.getCurrentTab();
    this.getTeams();
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.teams.length !== this.props.teams.length) {
      this.getTeams();
    }
  }

  getCurrentTab() {
    const {location} = this.props;

    const pathname = location.pathname;

    if (pathname.endsWith('all-teams/')) {
      this.setState({currentTab: TAB.ALL_TEAMS});
      return;
    }

    this.setState({currentTab: TAB.MY_TEAMS});
  }

  getTeams() {
    const {teams} = this.props;
    this.setState({
      teams,
      myTeams: teams.filter(team => team.isMember),
    });
  }

  getCrumbs() {
    const {currentTab} = this.state;
    const {organization} = this.props;
    const orgSlug = organization.slug;
    const crumbs = [
      {
        to: `/organizations/${orgSlug}/`,
        label: orgSlug,
        preserveGlobalSelection: true,
      },
    ];

    if (currentTab === TAB.ALL_TEAMS) {
      return [...crumbs, {label: t('All Teams')}];
    }

    return [...crumbs, {label: t('My Teams')}];
  }

  handleCreateTeam = () => {
    const {organization} = this.props;
    openCreateTeamModal({organization});
  };

  handleLeaveTeam = (teamToLeave: Team) => () => {
    const {api, organization} = this.props;
    const {teams, myTeams} = this.state;

    leaveTheTeam({
      teamToLeave,
      organization,
      api,
      onSubmitSuccess: leftTeam => {
        const updatedTeams = teams.map(team => {
          if (team.id === leftTeam.id) {
            return leftTeam;
          }
          return team;
        });

        const updatedMyTeams = myTeams.filter(team => team.id !== leftTeam.id);

        this.setState({teams: updatedTeams, myTeams: updatedMyTeams});
      },
    });
  };

  handleRequestAccess = (teamToJoin: Team) => () => {
    this.handleJoinTeam(teamToJoin, 'request');
  };

  handleJoinTeam = (teamToJoin: Team, type: 'join' | 'request' = 'join') => () => {
    const {organization, api} = this.props;
    const {teams, myTeams} = this.state;

    joinTheTeam({
      type,
      teamToJoin,
      organization,
      api,
      onSubmitSuccess: joinedTeam => {
        const updatedTeams = teams.map(team => {
          if (team.id === joinedTeam.id) {
            return joinedTeam;
          }
          return team;
        });
        const updatedMyTeams = [...myTeams, joinedTeam];
        this.setState({teams: updatedTeams, myTeams: updatedMyTeams});
      },
    });
  };

  renderHeader() {
    const {organization, location, params, routes} = this.props;
    const {currentTab, myTeams, teams} = this.state;

    const hasTeamAdminAccess = organization.access.includes('project:admin');
    const baseUrl = recreateRoute('', {location, routes, params, stepBack: -2});

    return (
      <React.Fragment>
        <PageHeader>
          <Breadcrumbs crumbs={this.getCrumbs()} />
          <Button
            disabled={!hasTeamAdminAccess}
            title={
              !hasTeamAdminAccess
                ? t('You do not have permission to create teams')
                : undefined
            }
            onClick={this.handleCreateTeam}
            icon={<IconGroup />}
          >
            {t('Create Team')}
          </Button>
        </PageHeader>
        <NavTabs>
          <ListLink
            to={`${baseUrl}all-teams/`}
            isActive={() => currentTab === TAB.ALL_TEAMS}
            onClick={() => this.setState({currentTab: TAB.ALL_TEAMS})}
          >
            {t('All Teams')}
            <Badge
              text={teams.length}
              priority={currentTab === TAB.ALL_TEAMS ? 'active' : undefined}
            />
          </ListLink>
          <ListLink
            to={`${baseUrl}my-teams/`}
            isActive={() => currentTab === TAB.MY_TEAMS}
            onClick={() => this.setState({currentTab: TAB.MY_TEAMS})}
          >
            {t('My Teams')}
            <Badge
              text={myTeams.length}
              priority={currentTab === TAB.MY_TEAMS ? 'active' : undefined}
            />
          </ListLink>
        </NavTabs>
      </React.Fragment>
    );
  }

  renderContent() {
    const {currentTab, teams, myTeams} = this.state;
    const {organization, location} = this.props;

    const access = new Set(organization.access);
    const features = new Set(organization.features);
    const hasTeamAdminAccess = access.has('project:admin');
    const hasOpenMembership = !!(
      features.has('open-membership') || access.has('org:write')
    );

    const tabListTeamProps = {
      onCreateTeam: this.handleCreateTeam,
      onJoinTeam: this.handleJoinTeam,
      onLeaveTeam: this.handleLeaveTeam,
      onRequestAccess: this.handleRequestAccess,
      teams,
      organization,
      location,
      hasTeamAdminAccess,
      hasOpenMembership,
    };

    if (currentTab === TAB.ALL_TEAMS) {
      return <AllTeams {...tabListTeamProps} />;
    }

    return <MyTeams {...tabListTeamProps} myTeams={myTeams} />;
  }

  render() {
    const {organization} = this.props;

    return (
      <LocalStorageContext.Provider>
        <React.Fragment>
          <SentryDocumentTitle title={t('Teams')} objSlug={organization.slug} />
          <PageContent>
            {this.renderHeader()}
            {this.renderContent()}
          </PageContent>
        </React.Fragment>
      </LocalStorageContext.Provider>
    );
  }
}

export default withApi(withOrganization(withTeams(TeamsTabDashboard)));
