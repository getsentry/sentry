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
import {t, tct} from 'app/locale';
import {PageContent, PageHeader} from 'app/styles/organization';
import {Organization, Team} from 'app/types';
import withOrganization from 'app/utils/withOrganization';
import recreateRoute from 'app/utils/recreateRoute';
import withTeams from 'app/utils/withTeams';
import Breadcrumbs from 'app/components/breadcrumbs';
import {joinTeam, leaveTeam} from 'app/actionCreators/teams';
import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import {Client} from 'app/api';

import AllTeams from './allTeams';
import MyTeams from './myTeams';
import {TAB} from './utils';
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
    currentTab: TAB.DASHBOARD,
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

  handleRequestAccess = (team: Team) => () => {
    this.joinTeam({
      successMessage: tct('You have requested access to [team]', {
        team: `#${team.slug}`,
      }),

      errorMessage: tct('Unable to request access to [team]', {
        team: `#${team.slug}`,
      }),
      team: {...team, isPending: true},
    });
  };

  handleJoinTeam = (team: Team) => () => {
    this.joinTeam({
      successMessage: tct('You have joined [team]', {
        team: `#${team.slug}`,
      }),
      errorMessage: tct('Unable to join [team]', {
        team: `#${team.slug}`,
      }),
      team,
    });
  };

  joinTeam = ({successMessage, errorMessage, team: teamToJoin}) => {
    const {api, organization} = this.props;

    joinTeam(
      api,
      {
        orgId: organization.slug,
        teamId: teamToJoin.slug,
      },
      {
        success: (joinedTeam: Team) => {
          this.setState(prevState => ({
            teams: prevState.teams.map(team => {
              if (team.id === teamToJoin.id) {
                return joinedTeam;
              }
              return team;
            }),
            myTeams: [...prevState.myTeams, joinedTeam],
          }));
          addSuccessMessage(successMessage);
        },
        error: () => {
          addErrorMessage(errorMessage);
        },
      }
    );
  };

  handleLeaveTeam = (teamToLeave: Team) => () => {
    const {api, organization} = this.props;

    leaveTeam(
      api,
      {
        orgId: organization.slug,
        teamId: teamToLeave.slug,
      },
      {
        success: (leftTeam: Team) => {
          this.setState(prevState => ({
            teams: prevState.teams.map(team => {
              if (team.id === leftTeam.id) {
                return leftTeam;
              }
              return team;
            }),
            myTeams: prevState.myTeams.filter(team => team.id !== leftTeam.id),
          }));

          addSuccessMessage(
            tct('You have left [team]', {
              team: `#${teamToLeave.slug}`,
            })
          );
        },
        error: () => {
          addErrorMessage(
            tct('Unable to leave [team]', {
              team: `#${teamToLeave.slug}`,
            })
          );
        },
      }
    );
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
