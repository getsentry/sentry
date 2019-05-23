import React from 'react';
import moment from 'moment';
import styled from 'react-emotion';

import {PageContent} from 'app/styles/organization';
import {t} from 'app/locale';
import LineChart from 'app/components/charts/lineChart';
import Link from 'app/components/links/link';
import MarkPoint from 'app/components/charts/components/markPoint';
import NavTabs from 'app/components/navTabs';
import SeenByList from 'app/components/seenByList';
import SentryTypes from 'app/sentryTypes';
import space from 'app/styles/space';
import theme from 'app/utils/theme';

import Activity from './activity';
import IncidentsSuspects from './suspects';
import detectedSymbol from './detectedSymbol';
import closedSymbol from './closedSymbol';

const TABS = {
  activity: {name: t('Activity'), component: Activity},
};

function getClosestIndex(data, needle) {
  const index = data.findIndex(([ts], i) => ts > needle);
  if (index === 0) {
    return 0;
  }

  return index !== -1 ? index - 1 : data.length - 1;
}

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

    const chartData =
      incident &&
      incident.eventStats.data.map(([ts, val], i) => {
        return [
          ts * 1000,
          val.length ? val.reduce((acc, {count} = {count: 0}) => acc + count, 0) : 0,
        ];
      });

    const detectedTs = incident && moment.utc(incident.dateDetected).unix();
    const closedTs =
      incident && incident.dateClosed && moment.utc(incident.dateClosed).unix();

    const closestDetectedTimestampIndex =
      detectedTs && getClosestIndex(incident.eventStats.data, detectedTs);
    const closestClosedTimestampIndex =
      closedTs && getClosestIndex(incident.eventStats.data, closedTs);

    const detectedCoordinate = chartData && chartData[closestDetectedTimestampIndex];
    const closedCoordinate =
      chartData && closedTs && chartData[closestClosedTimestampIndex];

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
            {incident && (
              <LineChart
                isGroupedByDate
                series={[
                  {
                    seriesName: t('Events'),
                    dataArray: chartData,
                    markPoint: MarkPoint({
                      data: [
                        {
                          symbol: `image://${detectedSymbol}`,
                          name: t('Incident Detected'),
                          coord: detectedCoordinate,
                        },
                        ...(closedTs
                          ? [
                              {
                                symbol: `image://${closedSymbol}`,
                                symbolSize: 24,
                                name: t('Incident Closed'),
                                coord: closedCoordinate,
                              },
                            ]
                          : []),
                      ],
                    }),
                  },
                ]}
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
