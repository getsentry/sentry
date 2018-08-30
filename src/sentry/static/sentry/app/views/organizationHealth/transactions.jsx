import {Flex} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {t} from 'app/locale';
import AreaChart from 'app/components/charts/areaChart';
import LineChart from 'app/components/charts/lineChart';
import PanelChart from 'app/components/charts/panelChart';
import SentryTypes from 'app/sentryTypes';
import space from 'app/styles/space';

import EventsTableChart from './eventsTableChart';
import HealthRequest from './util/healthRequest';
import withHealth from './util/withHealth';

class OrganizationHealthTransactions extends React.Component {
  static propTypes = {
    actions: PropTypes.object,
    organization: SentryTypes.Organization,
  };

  render() {
    let {className} = this.props;
    return (
      <div className={className}>
        <HealthRequest
          tag="transaction"
          showLoading
          includeTimeseries
          includeTimeAggregation="Transactions"
          includePrevious
        >
          {({timeseriesData, timeAggregatedData, previousTimeseriesData}) => {
            return (
              <Flex>
                <StyledPanelChart
                  showLegend={false}
                  height={400}
                  title={t('Transactions')}
                  previousPeriod={previousTimeseriesData}
                >
                  {props => <LineChart {...props} series={[timeAggregatedData]} />}
                </StyledPanelChart>
              </Flex>
            );
          }}
        </HealthRequest>

        <HealthRequest
          tag="transaction"
          showLoading
          includeTop
          includeTimeseries
          includeTimeAggregation="Transactions"
          includePercentages
          includePrevious
          limit={10}
        >
          {({
            timeseriesData,
            tagDataWithPercentages,
            timeAggregatedData,
            previousTimeseriesData,
          }) => {
            return (
              <React.Fragment>
                <Flex>
                  <StyledPanelChart
                    showLegend={false}
                    height={400}
                    title={t('Transactions')}
                    series={timeseriesData}
                    previousPeriod={previousTimeseriesData}
                  >
                    {props => <AreaChart {...props} />}
                  </StyledPanelChart>
                </Flex>
                <Flex>
                  <EventsTableChart
                    headers={[
                      t('Transaction'),
                      t('Events'),
                      t('Percentage'),
                      t('Last event'),
                    ]}
                    data={tagDataWithPercentages}
                  />
                </Flex>
              </React.Fragment>
            );
          }}
        </HealthRequest>
      </div>
    );
  }
}

export default withHealth(OrganizationHealthTransactions);
export {OrganizationHealthTransactions};

const getChartMargin = () => `
  margin-right: ${space(2)};
  &:last-child {
    margin-right: 0;
  }
`;

const StyledPanelChart = styled(PanelChart)`
  ${getChartMargin};
  flex-shrink: 0;
  overflow: hidden;
`;
