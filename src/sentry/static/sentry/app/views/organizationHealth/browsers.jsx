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

class OrganizationHealthBrowsersOverview extends React.Component {
  static propTypes = {
    tag: PropTypes.string,
    title: PropTypes.string,
    onSetSpecifier: PropTypes.func,
  };

  render() {
    const {tag, title, onSetSpecifier} = this.props;

    return (
      <React.Fragment>
        <Flex>
          <HealthRequest
            tag={tag}
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
                      seriesName: title,
                      data: tagData.map(([name, value]) => ({name, value})),
                    },
                  ]}
                  title={title}
                >
                  {({series}) => <PieChart height={300} series={series} selectOnRender />}
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
            tag={tag}
            showLoading
            includeTimeseries={false}
            includeTop
            includePercentages
            limit={5}
          >
            {({tagDataWithPercentages}) => {
              return (
                <EventsTableChart
                  headers={[title, t('Events'), t('Percentage'), t('Last event')]}
                  data={tagDataWithPercentages}
                  onRowClick={onSetSpecifier}
                />
              );
            }}
          </HealthRequest>
        </Flex>
      </React.Fragment>
    );
  }
}
class OrganizationHealthBrowsers extends React.Component {
  render() {
    const title = t('Browsers');

    return (
      <DetailContainer title={title}>
        {({shouldShowDetails, setSpecifier}) => (
          <React.Fragment>
            {shouldShowDetails ? (
              <OrganizationHealthDetails title={title} />
            ) : (
              <OrganizationHealthBrowsersOverview
                tag="browser.name"
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

export default OrganizationHealthBrowsers;
export {OrganizationHealthBrowsers};
