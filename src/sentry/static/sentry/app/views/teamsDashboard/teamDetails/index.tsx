import React from 'react';
import {RouteComponentProps} from 'react-router/lib/Router';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import {Team} from 'app/types';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';
import {PageContent} from 'app/styles/organization';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import withTeam from 'app/utils/withTeam';
import ListLink from 'app/components/links/listLink';
import NavTabs from 'app/components/navTabs';
import LoadingIndicator from 'app/components/loadingIndicator';
import space from 'app/styles/space';
import recreateRoute from 'app/utils/recreateRoute';

import Header from './header';
import Dashboard from './dashboard';

type Props = RouteComponentProps<{orgSlug: string; teamSlug: string}, {}> & {
  team: Team;
  isLoading: boolean;
};

type State = {
  searchTerm: string;
};

class TeamDetails extends React.Component<Props, State> {
  state: State = {searchTerm: ''};

  handleSearch = () => {};

  rendertabContent = () => {};

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

    const baseUrl = recreateRoute('', {location, routes, params, stepBack: -1});

    return (
      <StyledPageContent>
        <Header
          team={team}
          teamSlug={teamSlug}
          orgSlug={orgSlug}
          origin={baseUrl.endsWith('all-teams/') ? 'all-teams' : 'my-teams'}
        />
        <Body>
          <StyledNavTabs>
            <ListLink to="" index isActive={() => true}>
              {t('Team Feed')}
            </ListLink>
            <ListLink to="" isActive={() => false}>
              {t('Team Goals')}
            </ListLink>
            <ListLink to="" isActive={() => false}>
              {t('Projects')}
            </ListLink>
            <ListLink to="" isActive={() => false}>
              {t('Members')}
            </ListLink>
            <ListLink to="" isActive={() => false}>
              {t('Settings')}
            </ListLink>
          </StyledNavTabs>
          <TabContent>
            <Dashboard />
          </TabContent>
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
  background: ${p => p.theme.white};
`;
