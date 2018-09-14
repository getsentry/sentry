import {Flex} from 'grid-emotion';
import React from 'react';

import {t} from 'app/locale';
import LineChart from 'app/components/charts/lineChart';
import PieChart from 'app/components/charts/pieChart';

import HealthPanelChart from './styles/healthPanelChart';
import HealthRequest from './util/healthRequest';
import withHealth from './util/withHealth';

class OrganizationHealthDetails extends React.Component {
  render() {
    return (
      <React.Fragment>
        <Flex>
          <HealthRequest
            tag="error.handled"
            includePrevious
            showLoading
            interval="1d"
            includeTimeseries
            includeTimeAggregation
            timeAggregationSeriesName={t('Errors')}
          >
            {({timeseriesData, timeAggregatedData, previousTimeseriesData}) => {
              return (
                <HealthPanelChart
                  height={200}
                  showLegend
                  series={[timeAggregatedData]}
                  previousPeriod={previousTimeseriesData}
                  title={t('Errors')}
                >
                  {props => <LineChart isGroupedByDate {...props} />}
                </HealthPanelChart>
              );
            }}
          </HealthRequest>

          <HealthRequest
            tag="os.name"
            showLoading
            includeTimeseries={false}
            includeTop
            limit={5}
          >
            {({tagData}) => {
              return (
                <HealthPanelChart
                  showLegend={false}
                  height={200}
                  series={[
                    {
                      seriesName: t('By Device'),
                      data: tagData.map(([name, value]) => ({name, value})),
                    },
                  ]}
                  title={t('By Device')}
                >
                  {({series}) => <PieChart height={300} series={series} selectOnRender />}
                </HealthPanelChart>
              );
            }}
          </HealthRequest>
        </Flex>
      </React.Fragment>
    );
  }
}
export default withHealth(OrganizationHealthDetails);
export {OrganizationHealthDetails};
