import {Flex} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';

import {t} from 'app/locale';
import OrganizationHealthDetails from 'app/views/organizationHealth/details';
import PieChart from 'app/components/charts/pieChart';

import DetailContainer from './detailContainer';
import EventsTableChart from './eventsTableChart';
import HealthPanelChart from './styles/healthPanelChart';
import HealthRequest from './util/healthRequest';

class OrganizationHealthDevicesOverview extends React.Component {
  static propTypes = {
    tag: PropTypes.string,
    title: PropTypes.string,
    onSetSpecifier: PropTypes.func,
  };

  render() {
    const {title, tag, onSetSpecifier} = this.props;
    return (
      <HealthRequest
        tag={tag}
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
                height={300}
                showLegend={false}
                series={[
                  {
                    seriesName: title,
                    data: tagData.map(([name, value]) => ({name, value})),
                  },
                ]}
                title={title}
              >
                {({series}) => <PieChart height={300} selectOnRender series={series} />}
              </HealthPanelChart>
            </Flex>

            <Flex>
              <EventsTableChart
                headers={[t('Device'), t('Events'), t('Percentage'), t('Last event')]}
                data={tagDataWithPercentages}
                onRowClick={onSetSpecifier}
              />
            </Flex>
          </React.Fragment>
        )}
      </HealthRequest>
    );
  }
}

class OrganizationHealthDevices extends React.Component {
  render() {
    const title = t('Devices');

    return (
      <DetailContainer title={title}>
        {({shouldShowDetails, setSpecifier}) => (
          <React.Fragment>
            {shouldShowDetails ? (
              <OrganizationHealthDetails title={title} />
            ) : (
              <OrganizationHealthDevicesOverview
                tag="device"
                title={title}
                onSetSpecifier={setSpecifier}
              />
            )}
          </React.Fragment>
        )}
      </DetailContainer>
    );
  }
}

export default OrganizationHealthDevices;
export {OrganizationHealthDevices};
