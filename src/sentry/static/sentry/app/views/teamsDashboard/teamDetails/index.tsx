import React from 'react';
import {RouteComponentProps} from 'react-router/lib/Router';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import {Team, Project} from 'app/types';
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

import Header from './header';
import Feed from './feed';

enum TAB {
  TEAM_FEED = 'team_feed',
  TEAM_GOALS = 'team_goals',
  PROJECTS = 'projects',
  MEMBERS = 'members',
  SETTINGS = 'settings',
}

type Props = RouteComponentProps<{orgSlug: string; teamSlug: string}, {}> &
  AsyncComponent['props'] & {
    team: Team;
    projects: Array<Project>;
    isLoading: boolean;
  };

type State = AsyncComponent['state'] & {
  searchTerm: string;
  currentTab: TAB;
};

class TeamDetails extends AsyncComponent<Props, State> {
  componentDidMount() {
    this.getCurrentTab();
  }

  getDefaultState(): State {
    return {
      ...super.getDefaultState(),
      searchTerm: '',
      currentTab: TAB.TEAM_FEED,
      projects: [],
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
            query: `!team:${teamSlug}`,
          },
        },
      ],
    ];
  }

  getCurrentTab() {
    const {location} = this.props;

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

    this.setState({currentTab});
  }

  handleSearch = () => {};

  renderTabContent = () => {
    const {currentTab} = this.state;

    switch (currentTab) {
      case TAB.TEAM_FEED:
        return <Feed />;
      case TAB.TEAM_GOALS:
        return <div>Team Goals</div>;
      case TAB.PROJECTS:
        return <div>Projects</div>;
      case TAB.MEMBERS:
        return <div>Members</div>;
      case TAB.SETTINGS:
        return <div>Settings</div>;
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
    const baseTabUrl = `${baseUrl}${teamSlug}/`;

    return (
      <StyledPageContent>
        <Header
          team={team}
          teamSlug={teamSlug}
          orgSlug={orgSlug}
          origin={baseUrl.endsWith('all-teams/') ? 'all-teams' : 'my-teams'}
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
            </ListLink>
            <ListLink
              to={`${baseTabUrl}members/`}
              isActive={() => currentTab === TAB.MEMBERS}
              onClick={() => this.setState({currentTab: TAB.MEMBERS})}
            >
              {t('Members')}
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
      <React.Fragment>
        <SentryDocumentTitle title={t('Team %s', teamSlug)} objSlug={orgSlug} />
        <Wrapper>{this.renderContent()}</Wrapper>
      </React.Fragment>
    );
  }
}

export default withTeam(TeamDetails);

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

const StyledNavTabs = styled(NavTabs)`
  margin-bottom: 0;
`;

const TabContent = styled('div')`
  display: flex;
  flex: 1;
  flex-direction: column;
  background: ${p => p.theme.white};
`;
