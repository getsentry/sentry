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
import Button from 'app/components/button';
import {IconFilter} from 'app/icons';
import SearchBar from 'app/components/searchBar';
import Avatar from 'app/components/avatar';

import Header from './header';

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

    const {members = []} = team;

    return (
      <StyledPageContent>
        <Header team={team} teamSlug={teamSlug} orgSlug={orgSlug} />
        <Body>
          <StyledNavTabs underlined>
            <ListLink to="" index isActive={() => true}>
              {t('Projects')}
            </ListLink>
            <ListLink to="" isActive={() => false}>
              {t('Members')}
            </ListLink>
            <ListLink to="" isActive={() => false}>
              {t('Activity')}
            </ListLink>
            <ListLink to="" isActive={() => false}>
              {t('Usage')}
            </ListLink>
            <ListLink to="" isActive={() => false}>
              {t('Settings')}
            </ListLink>
          </StyledNavTabs>
          <TabContent>
            <TabContentLeft>
              <SearchWrapper>
                <SearchBar
                  defaultQuery=""
                  query={this.state.searchTerm}
                  placeholder={t('Search for projectss')}
                  onSearch={this.handleSearch}
                />
                <Button label={t('Filter')} icon={<IconFilter />} size="small" />
              </SearchWrapper>
            </TabContentLeft>
            <TabContentRight>
              <div>
                <Heading>{t('Teams Members')}</Heading>
                <Members membersQuantity={members.length}>
                  {members.map(member => (
                    <Avatar key={member.id} user={member.user} size={32} />
                  ))}
                </Members>
              </div>
            </TabContentRight>
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

const TabContentLeft = styled('div')`
  width: 100%;
  padding: ${space(4)} ${space(2)} 0 ${space(2)};
`;

const TabContentRight = styled('div')`
  padding: ${space(4)} ${space(2)} 0 ${space(2)};
  min-width: 285px;
  border-left: 1px solid ${p => p.theme.gray300};
`;

const SearchWrapper = styled('div')`
  display: grid;
  grid-template-columns: 1fr max-content;
  grid-gap: ${space(3)};
`;

const Heading = styled('h6')`
  margin: 0 !important;
  font-weight: 600;
`;

const Members = styled('div')<{membersQuantity: number}>`
  margin-top: ${space(1)};
  display: grid;
  grid-template-columns: repeat(${p => p.membersQuantity}, 1fr);
  grid-gap: ${space(0.5)};
`;
