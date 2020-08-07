import React from 'react';
import {RouteComponentProps} from 'react-router/lib/Router';
import styled from '@emotion/styled';
import {Location} from 'history';

import Badge from 'app/components/badge';
import {t} from 'app/locale';
import {Team, Organization, Member, Project} from 'app/types';
import {sortProjects} from 'app/utils';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';
import {PageContent} from 'app/styles/organization';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import withTeam from 'app/utils/withTeam';
import ListLink from 'app/components/links/listLink';
import NavTabs from 'app/components/navTabs';
import LoadingIndicator from 'app/components/loadingIndicator';
import space from 'app/styles/space';
import recreateRoute from 'app/utils/recreateRoute';
import withOrganization from 'app/utils/withOrganization';

import Header from './header';
import Feed from './feed';
import Projects from './projects';
import Members from './members';
import Goals from './goals';
import Settings from './settings';
import * as LocalStorageContext from '../withLocalStorage';

enum TAB {
  FEED = 'feed',
  GOALS = 'goals',
  PROJECTS = 'projects',
  MEMBERS = 'members',
  SETTINGS = 'settings',
}

type Props = RouteComponentProps<{orgSlug: string; teamSlug: string}, {}> & {
  team: Team;
  isLoading: boolean;
  organization: Organization;
  location: Location;
};

type State = {
  searchTerm: string;
  currentTab: TAB;
  members: Array<Member>;
  projects: Array<Project>;
};

const getCurrentTab = (location: Location): TAB => {
  const pathnameEnd = location.pathname.split('/');
  const pathname = pathnameEnd[pathnameEnd.length - 2];
  let currentTab = TAB.FEED;

  switch (pathname) {
    case TAB.GOALS:
      currentTab = TAB.GOALS;
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
      currentTab = TAB.FEED;
  }

  return currentTab;
};

class TeamDetails extends React.Component<Props, State> {
  state: State = {
    searchTerm: '',
    currentTab: TAB.FEED,
    members: [],
    projects: [],
  };

  static getDerivedStateFromProps(props: Props, state: State): State {
    const {location} = props;

    return {
      ...state,
      projects: props?.team?.projects ?? [],
      members: props?.team?.members ?? [],
      currentTab: getCurrentTab(location),
    };
  }

  componentDidUpdate(prevProps: Props) {
    if (!prevProps.team?.members?.length && this.props.team?.members?.length) {
      this.getMembers();
    }

    if (!prevProps.team?.projects?.length && this.props.team?.projects?.length) {
      this.getProjects();
    }
  }

  getProjects() {
    this.setState({projects: this.props.team.projects || []});
  }

  getMembers() {
    this.setState({members: this.props.team.members || []});
  }

  handleUpdateMembers = (newMembers: Array<Member>) => {
    this.setState({members: newMembers});
  };

  renderTabContent = (canWrite: boolean, hasProjectAccess: boolean) => {
    const {currentTab, members, projects} = this.state;
    const {location, organization, team} = this.props;

    switch (currentTab) {
      case TAB.FEED:
        return (
          <Feed
            location={location}
            organization={organization}
            team={team}
            projects={projects}
          />
        );
      case TAB.GOALS:
        return (
          <Goals location={location} organization={organization} projects={projects} />
        );
      case TAB.PROJECTS:
        return (
          <Projects
            organization={organization}
            projects={sortProjects(projects)}
            hasAccess={hasProjectAccess}
          />
        );
      case TAB.MEMBERS:
        return (
          <Members
            organization={organization}
            teamSlug={team.slug}
            canWrite={canWrite}
            members={members}
            onUpdateMembers={this.handleUpdateMembers}
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
      params: {teamSlug},
      isLoading,
      location,
      routes,
      params,
      organization,
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

    const {currentTab, members, projects} = this.state;
    const baseUrl = recreateRoute('', {location, routes, params, stepBack: -2});
    const origin = baseUrl.endsWith('all-teams/') ? 'all-teams' : 'my-teams';
    const baseTabUrl = `${baseUrl}${teamSlug}/`;

    const access = new Set(organization.access);
    const canWrite = access.has('org:write') || access.has('team:admin');
    const hasProjectAccess = access.has('project:read');

    return (
      <StyledPageContent>
        <Header
          team={{...team, members}}
          teamSlug={teamSlug}
          organization={organization}
          origin={origin}
          projects={projects}
          canWrite={canWrite}
        />
        <Body>
          <StyledNavTabs>
            <ListLink
              to={`${baseTabUrl}feed/`}
              index
              isActive={() => currentTab === TAB.FEED}
              onClick={() => this.setState({currentTab: TAB.FEED})}
            >
              {t('Feed')}
            </ListLink>
            <ListLink
              to={`${baseTabUrl}goals/`}
              isActive={() => currentTab === TAB.GOALS}
              onClick={() => this.setState({currentTab: TAB.GOALS})}
            >
              {t('Goals')}
              <Badge
                text={2}
                priority={currentTab === TAB.GOALS ? 'active' : undefined}
              />
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
          <TabContent>{this.renderTabContent(canWrite, hasProjectAccess)}</TabContent>
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
        <SentryDocumentTitle title={t('Team %s', teamSlug)} objSlug={orgSlug} />
        <Wrapper>{this.renderContent()}</Wrapper>
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

const TabContent = styled('div')`
  display: flex;
  flex: 1;
  flex-direction: column;
  padding-bottom: ${space(4)};
  background: ${p => p.theme.white};
  margin: 0 -${space(4)};
  padding: ${space(2)} ${space(4)};
`;

const StyledNavTabs = styled(NavTabs)`
  margin-bottom: 0;
`;
