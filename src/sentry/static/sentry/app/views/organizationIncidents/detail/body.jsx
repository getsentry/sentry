import React from 'react';
import styled from 'react-emotion';

import {t} from 'app/locale';
import SentryTypes from 'app/sentryTypes';
import NavTabs from 'app/components/navTabs';
import Link from 'app/components/link';

import {PageContent} from 'app/styles/organization';
import theme from 'app/utils/theme';

import IncidentsSuspects from './suspects';
import Activity from './activity';
import RelatedIncidents from './relatedIncidents';

const TABS = {
  activity: {name: t('Activity'), component: Activity},
  related: {name: t('Related incidents'), component: RelatedIncidents},
};

export default class IncidentDetailsBody extends React.Component {
  static propTypes = {
    incident: SentryTypes.Incident,
  };
  constructor(props) {
    super(props);
    this.state = {
      activeTab: Object.keys(TABS)[0],
    };
  }
  handleToggle(tab) {
    this.setState({activeTab: tab});
  }

  render() {
    const {incident} = this.props;
    const {activeTab} = this.state;
    const ActiveComponent = TABS[activeTab].component;

    return (
      <StyledPageContent>
        <Main>
          <PageContent>
            <NavTabs underlined={true}>
              {Object.entries(TABS).map(([id, {name}]) => (
                <li key={id} className={activeTab === id ? 'active' : ''}>
                  <Link onClick={() => this.handleToggle(id)}>{name}</Link>
                </li>
              ))}
            </NavTabs>
            <ActiveComponent />
          </PageContent>
        </Main>
        <Sidebar>
          <PageContent>
            <IncidentsSuspects incident={incident} />
          </PageContent>
        </Sidebar>
      </StyledPageContent>
    );
  }
}

const Main = styled('div')`
  width: 60%;
  @media (max-width: ${theme.breakpoints[0]}) {
    width: 100%;
  }
`;

const Sidebar = styled('div')`
  width: 40%;
  border-left: 1px solid ${p => p.theme.borderLight};
  background-color: ${p => p.theme.white};
  @media (max-width: ${theme.breakpoints[0]}) {
    width: 100%;
    border: 0;
  }
`;

const StyledPageContent = styled(PageContent)`
  padding: 0;
  flex-direction: row;
  @media (max-width: ${theme.breakpoints[0]}) {
    flex-direction: column;
  }
`;
