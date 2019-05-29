import React from 'react';
import styled from 'react-emotion';

import {PageContent} from 'app/styles/organization';
import {t} from 'app/locale';
import Chart from 'app/views/organizationIncidents/details/chart';
import Link from 'app/components/links/link';
import NavTabs from 'app/components/navTabs';
import SeenByList from 'app/components/seenByList';
import SentryTypes from 'app/sentryTypes';
import SideHeader from 'app/views/organizationIncidents/details/sideHeader';
import space from 'app/styles/space';
import theme from 'app/utils/theme';

import Activity from './activity';
import IncidentsSuspects from './suspects';

const TABS = {
  activity: {name: t('Activity'), component: Activity},
};

export default class DetailsBody extends React.Component {
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
    const {params, incident} = this.props;
    const {activeTab} = this.state;
    const ActiveComponent = TABS[activeTab].component;

    return (
      <StyledPageContent>
        <Main>
          <PageContent>
            <StyledNavTabs underlined={true}>
              {Object.entries(TABS).map(([id, {name}]) => (
                <li key={id} className={activeTab === id ? 'active' : ''}>
                  <Link onClick={() => this.handleToggle(id)}>{name}</Link>
                </li>
              ))}

              <SeenByTab>
                {incident && (
                  <StyledSeenByList
                    iconPosition="right"
                    seenBy={incident.seenBy}
                    iconTooltip={t('People who have viewed this incident')}
                  />
                )}
              </SeenByTab>
            </StyledNavTabs>
            <ActiveComponent params={params} incident={incident} />
          </PageContent>
        </Main>
        <Sidebar>
          <PageContent>
            <SideHeader>{t('Events in Incident')}</SideHeader>
            {incident && (
              <Chart
                data={incident.eventStats.data}
                detected={incident.dateDetected}
                closed={incident.dateClosed}
              />
            )}
            <IncidentsSuspects suspects={[]} />
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

const StyledNavTabs = styled(NavTabs)`
  display: flex;
`;
const SeenByTab = styled('li')`
  flex: 1;
  margin-left: ${space(2)};

  .nav-tabs > & {
    margin-right: 0;
  }
`;

const StyledSeenByList = styled(SeenByList)`
  margin-top: 0;
`;
