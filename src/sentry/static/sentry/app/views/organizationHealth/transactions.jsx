import {Flex} from 'grid-emotion';
import React from 'react';

import {t} from 'app/locale';
import AreaChart from 'app/components/charts/areaChart';
import LineChart from 'app/components/charts/lineChart';

import {HealthContextActions} from './propTypes';
import HealthPanelChart from './styles/healthPanelChart';
import EventsTableChart from './eventsTableChart';
import HealthRequest from './util/healthRequest';
import withHealth from './util/withHealth';

class OrganizationHealthTransactions extends React.Component {
  static propTypes = {
    actions: HealthContextActions,
  };

  render() {
    let {className} = this.props;
    return (
      <div className={className}>
        <HealthRequest
          tag="transaction"
          showLoading
          includeTimeseries
          includeTimeAggregation
          timeAggregationSeriesName="Transactions"
          includePrevious
        >
          {({timeseriesData, timeAggregatedData, previousTimeseriesData}) => {
            return (
              <Flex>
                <HealthPanelChart
                  showLegend={false}
                  height={400}
                  title={t('Transactions')}
                  previousPeriod={previousTimeseriesData}
                >
                  {props => <LineChart {...props} series={[timeAggregatedData]} />}
                </HealthPanelChart>
              </Flex>
            );
          }}
        </HealthRequest>

        <HealthRequest
          tag="transaction"
          showLoading
          includeTop
          includeTimeseries
          includeTimeAggregation
          timeAggregationSeriesName="Transactions"
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
                  <HealthPanelChart
                    showLegend={false}
                    height={400}
                    title={t('Transactions')}
                    series={timeseriesData}
                    previousPeriod={previousTimeseriesData}
                  >
                    {props => <AreaChart {...props} />}
                  </HealthPanelChart>
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
