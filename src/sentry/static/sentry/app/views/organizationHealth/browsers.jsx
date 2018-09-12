import {Flex} from 'grid-emotion';
import React from 'react';

import {t} from 'app/locale';
import PieChart from 'app/components/charts/pieChart';

import EventsTableChart from './eventsTableChart';
import Header from './styles/header';
import HealthPanelChart from './styles/healthPanelChart';
import HealthRequest from './util/healthRequest';
import withHealth from './util/withHealth';

class OrganizationHealthBrowsers extends React.Component {
  render() {
    return (
      <React.Fragment>
        <Header>{t('Browsers')}</Header>

        <Flex>
          <HealthRequest
            tag="browser.name"
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
                      seriesName: t('Browsers'),
                      data: tagData.map(([name, value]) => ({name, value})),
                    },
                  ]}
                  title={t('Browsers')}
                >
                  {({series}) => <PieChart height={300} series={series} selectOnRender />}
                </HealthPanelChart>
              );
            }}
          </HealthRequest>

          <HealthRequest
            tag="os.name"
            showLegend={false}
            showLoading
            includeTimeseries={false}
            includeTop
            limit={5}
          >
            {({tagData}) => {
              return (
                <HealthPanelChart
                  height={200}
                  series={[
                    {
                      seriesName: t('OS'),
                      data: tagData.map(([name, value]) => ({name, value})),
                    },
                  ]}
                  title={t('OS')}
                >
                  {({series}) => <PieChart height={300} series={series} selectOnRender />}
                </HealthPanelChart>
              );
            }}
          </HealthRequest>
        </Flex>

        <Flex>
          <HealthRequest
            tag="browser.name"
            showLoading
            includeTimeseries={false}
            includeTop
            includePercentages
            limit={5}
          >
            {({tagDataWithPercentages}) => {
              return (
                <EventsTableChart
                  headers={[t('Browser'), t('Events'), t('Percentage'), t('Last event')]}
                  data={tagDataWithPercentages}
                />
              );
            }}
          </HealthRequest>
        </Flex>
      </React.Fragment>
    );
  }
}

export default withHealth(OrganizationHealthBrowsers);
export {OrganizationHealthBrowsers};
