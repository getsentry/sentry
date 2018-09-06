import {Flex} from 'grid-emotion';
import React from 'react';

import {t} from 'app/locale';
import PieChart from 'app/components/charts/pieChart';

import EventsTableChart from './eventsTableChart';
import Header from './styles/header';
import HealthPanelChart from './styles/healthPanelChart';
import HealthRequest from './util/healthRequest';
import withHealth from './util/withHealth';

class OrganizationHealthDevices extends React.Component {
  render() {
    return (
      <React.Fragment>
        <Flex justify="space-between">
          <Header>{t('Devices')}</Header>
        </Flex>

        <HealthRequest
          tag="device"
          showLoading
          includeTimeseries={false}
          includeTop
          includePercentages
          limit={5}
        >
          {({tagData, tagDataWithPercentages}) => (
            <React.Fragment>
              <Flex>
                <HealthPanelChart
                  height={200}
                  showLegend={false}
                  series={[
                    {
                      seriesName: t('Devices'),
                      data: tagData.map(([name, value]) => ({name, value})),
                    },
                  ]}
                  title={t('Devices')}
                >
                  {({series}) => <PieChart height={300} selectOnRender series={series} />}
                </HealthPanelChart>
              </Flex>

              <Flex>
                <EventsTableChart
                  headers={[t('Device'), t('Events'), t('Percentage'), t('Last event')]}
                  data={tagDataWithPercentages}
                />
              </Flex>
            </React.Fragment>
          )}
        </HealthRequest>
      </React.Fragment>
    );
  }
}

export default withHealth(OrganizationHealthDevices);
export {OrganizationHealthDevices};
