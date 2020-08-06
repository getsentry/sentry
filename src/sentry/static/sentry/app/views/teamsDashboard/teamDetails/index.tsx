import React from 'react';
import {RouteComponentProps} from 'react-router/lib/Router';
import styled from '@emotion/styled';
import {Location} from 'history';

import Badge from 'app/components/badge';
import {t} from 'app/locale';
import {Team, Project, Organization} from 'app/types';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';
import {PageContent} from 'app/styles/organization';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import withTeam from 'app/utils/withTeam';
import ListLink from 'app/components/links/listLink';
import NavTabs from 'app/components/navTabs';
import LoadingIndicator from 'app/components/loadingIndicator';
import space from 'app/styles/space';
import recreateRoute from 'app/utils/recreateRoute';
import AsyncComponent from 'app/components/asyncComponent';
import withOrganization from 'app/utils/withOrganization';

import Header from './header';
import Feed from './feed';
import Projects from './projects';
import Members from './members';
import Settings from './settings';
import * as LocalStorageContext from '../withLocalStorage';

enum TAB {
  TEAM_FEED = 'team-feed',
  TEAM_GOALS = 'team-goals',
  PROJECTS = 'projects',
  MEMBERS = 'members',
  SETTINGS = 'settings',
}

type Props = RouteComponentProps<{orgSlug: string; teamSlug: string}, {}> &
  AsyncComponent['props'] & {
    team: Team;
    projects: Array<Project>;
    isLoading: boolean;
    organization: Organization;
    location: Location;
  };

type State = AsyncComponent['state'] & {
  searchTerm: string;
  currentTab: TAB;
  projectsPageLinks: string;
};

const getCurrentTab = (location: Location): TAB => {
  const pathnameEnd = location.pathname.split('/');
  const pathname = pathnameEnd[pathnameEnd.length - 2];
  let currentTab = TAB.TEAM_FEED;

  switch (pathname) {
    case TAB.TEAM_GOALS:
      currentTab = TAB.TEAM_GOALS;
      break;
    case TAB.PROJECTS:
      currentTab = TAB.PROJECTS;
      break;
    case TAB.MEMBERS:
      currentTab = TAB.MEMBERS;
      break;
    case TAB.SETTINGS:
      currentTab = TAB.SETTINGS;
      break;
    default:
      currentTab = TAB.TEAM_FEED;
  }

  return currentTab;
};

class TeamDetails extends AsyncComponent<Props, State> {
  componentDidMount() {
    // I have no excuses other than I need this to work
    super.UNSAFE_componentWillMount();
    this.fetchUnlinkedProjects();
  }

  static getDerivedStateFromProps(props: Props, state: State): State {
    const {location} = props;

    return {
      ...state,
      currentTab: getCurrentTab(location),
    };
  }

  getDefaultState(): State {
    return {
      ...super.getDefaultState(),
      searchTerm: '',
      projectsPageLinks: '',
      currentTab: TAB.TEAM_FEED,
      projects: [],
      unlinkedProjects: [],
    };
  }

  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {
      params: {teamSlug, orgSlug},
    } = this.props;
    return [
      [
        'projects',
        `/organizations/${orgSlug}/projects/`,
        {
          query: {
            query: `team:${teamSlug}`,
          },
          includeAllArgs: true,
        },
      ],
    ];
  }

  fetchUnlinkedProjects = async (query?: string) => {
    const {
      params: {teamSlug, orgSlug},
    } = this.props;

    try {
      const unlinkedProjects = await this.api.requestPromise(
        `/organizations/${orgSlug}/projects/`,
        {
          query: {
            query: query ? `!team:${teamSlug} ${query}` : `!team:${teamSlug}`,
          },
        }
      );

      this.setState({unlinkedProjects});
    } catch {
      //error
    }
  };

  handleSearch = () => {};

  renderTabContent = () => {
    const {currentTab, projects, unlinkedProjects, projectsPageLinks} = this.state;
    const {organization, team} = this.props;

    const access = new Set(organization.access);
    const canWrite = access.has('org:write') || access.has('team:admin');

    switch (currentTab) {
      case TAB.TEAM_FEED:
        return <Feed organization={organization} team={team} projects={projects} />;
      case TAB.TEAM_GOALS:
        return <div>Team Goals</div>;
      case TAB.PROJECTS:
        return (
          <Projects
            organization={organization}
            projects={projects}
            unlinkedProjects={unlinkedProjects}
            canWrite={canWrite}
            api={this.api}
            teamSlug={team.slug}
            pageLinks={projectsPageLinks}
            onQueryUpdate={this.fetchUnlinkedProjects}
            reloadData={() => {
              this.reloadData();
            }}
          />
        );
      case TAB.MEMBERS:
        return (
          <Members
            organization={organization}
            api={this.api}
            teamSlug={team.slug}
            canWrite={canWrite}
            members={team.members}
          />
        );
      case TAB.SETTINGS:
        return <Settings organization={organization} team={team} />;
      default:
        return null;
    }
  };

  renderContent() {
    const {
      team,
      params: {teamSlug, orgSlug},
      isLoading,
      location,
      routes,
      params,
    } = this.props;

    if (isLoading) {
      return <LoadingIndicator />;
    }

    if (!team) {
      return (
        <EmptyStateWarning>
          <p>{t("Team '%s' was not found", teamSlug)}</p>
        </EmptyStateWarning>
      );
    }

    const {currentTab, projects} = this.state;
    const baseUrl = recreateRoute('', {location, routes, params, stepBack: -2});
    const origin = baseUrl.endsWith('all-teams/') ? 'all-teams' : 'my-teams';
    const baseTabUrl = `${baseUrl}${teamSlug}/`;
    const {members = []} = team;

    return (
      <StyledPageContent>
        <Header
          team={team}
          teamSlug={teamSlug}
          orgSlug={orgSlug}
          origin={origin}
          projects={projects}
        />
        <Body>
          <StyledNavTabs>
            <ListLink
              to={`${baseTabUrl}team-feed/`}
              index
              isActive={() => currentTab === TAB.TEAM_FEED}
              onClick={() => this.setState({currentTab: TAB.TEAM_FEED})}
            >
              {t('Team Feed')}
            </ListLink>
            <ListLink
              to={`${baseTabUrl}team-goals/`}
              isActive={() => currentTab === TAB.TEAM_GOALS}
              onClick={() => this.setState({currentTab: TAB.TEAM_GOALS})}
            >
              {t('Team Goals')}
            </ListLink>
            <ListLink
              to={`${baseTabUrl}projects/`}
              isActive={() => currentTab === TAB.PROJECTS}
              onClick={() => this.setState({currentTab: TAB.PROJECTS})}
            >
              {t('Projects')}
              <Badge
                text={projects.length}
                priority={currentTab === TAB.PROJECTS ? 'active' : undefined}
              />
            </ListLink>
            <ListLink
              to={`${baseTabUrl}members/`}
              isActive={() => currentTab === TAB.MEMBERS}
              onClick={() => this.setState({currentTab: TAB.MEMBERS})}
            >
              {t('Members')}
              <Badge
                text={members.length}
                priority={currentTab === TAB.MEMBERS ? 'active' : undefined}
              />
            </ListLink>
            <ListLink
              to={`${baseTabUrl}settings/`}
              isActive={() => currentTab === TAB.SETTINGS}
              onClick={() => this.setState({currentTab: TAB.SETTINGS})}
            >
              {t('Settings')}
            </ListLink>
          </StyledNavTabs>
          <TabContent>{this.renderTabContent()}</TabContent>
        </Body>
      </StyledPageContent>
    );
  }

  render() {
    const {
      params: {teamSlug, orgSlug},
    } = this.props;

    return (
      <LocalStorageContext.Provider>
        <React.Fragment>
          <SentryDocumentTitle title={t('Team %s', teamSlug)} objSlug={orgSlug} />
          <Wrapper>{this.renderContent()}</Wrapper>
        </React.Fragment>
      </LocalStorageContext.Provider>
    );
  }
}

export default withOrganization(withTeam(TeamDetails));

const Wrapper = styled('div')`
  display: flex;
  flex: 1;
  align-items: center;
  flex-direction: column;
  justify-content: center;
`;

const StyledPageContent = styled(PageContent)`
  width: 100%;
  padding-bottom: 0;
`;

const Body = styled('div')`
  margin-top: ${space(4)};
  flex: 1;
  display: flex;
  flex-direction: column;
`;

// TODO: do we need this?
const StyledNavTabs = styled(NavTabs)``;

const TabContent = styled('div')`
  display: flex;
  flex: 1;
  flex-direction: column;
  padding-bottom: ${space(4)};
`;
