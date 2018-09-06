import {Box, Flex} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {addErrorMessage} from 'app/actionCreators/indicator';
import {t} from 'app/locale';
import AreaChart from 'app/components/charts/areaChart';
import Count from 'app/components/count';
import IdBadge from 'app/components/idBadge';
import PercentageBarChart from 'app/components/charts/percentageBarChart';
import PieChart from 'app/components/charts/pieChart';
import SentryTypes from 'app/sentryTypes';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';
import withApi from 'app/utils/withApi';

import Header from './styles/header';
import HealthPanelChart from './styles/healthPanelChart';
import HealthRequest from './util/healthRequest';
import HealthTableChart from './styles/healthTableChart';
import withHealth from './util/withHealth';

class OrganizationHealthErrors extends React.Component {
  static propTypes = {
    actions: PropTypes.object,
    organization: SentryTypes.Organization,
  };

  handleSetSpecifier = (tag, value) => {
    this.props.actions.setSpecifier(tag, value);
  };

  render() {
    let {organization} = this.props;

    return (
      <React.Fragment>
        <Flex justify="space-between">
          <Header>{t('Errors')}</Header>
        </Flex>

        <Flex>
          <HealthRequest
            tag="error.handled"
            includeTimeseries
            interval="1d"
            showLoading
            getCategory={value => (value ? 'Handled' : 'Crash')}
          >
            {({timeseriesData}) => {
              return (
                <HealthPanelChart
                  height={200}
                  title={t('Errors')}
                  series={timeseriesData}
                >
                  {props => <AreaChart {...props} />}
                </HealthPanelChart>
              );
            }}
          </HealthRequest>

          <HealthRequest tag="user" showLoading includeTop includeTimeseries={false}>
            {({originalTagData: originalData, tag}) => (
              <HealthTableChart
                headers={[t('Most Impacted')]}
                data={originalData.map(row => [row, row])}
                widths={[null, 120]}
                getValue={item => (typeof item === 'number' ? item : item && item.count)}
                renderHeaderCell={({getValue, value, columnIndex}) => {
                  return typeof value === 'string' ? (
                    value
                  ) : (
                    <div>
                      <IdBadge
                        user={value[tag].value}
                        displayName={
                          value[tag] && value[tag].value && value[tag].value.label
                        }
                      />
                    </div>
                  );
                }}
                renderDataCell={({getValue, value, columnIndex}) => {
                  return <Count value={getValue(value)} />;
                }}
                showRowTotal={false}
                showColumnTotal={false}
                shadeRowPercentage
              />
            )}
          </HealthRequest>
        </Flex>

        <Flex>
          <HealthRequest
            tag="error.type"
            showLoading
            includeTimeseries={false}
            includeTop
            interval="1d"
          >
            {({tagData}) => {
              return (
                <HealthTableChart
                  title="Error Type"
                  headers={['Error type']}
                  data={tagData}
                  widths={[null, 60, 60, 60, 60]}
                  showColumnTotal
                  shadeRowPercentage
                />
              );
            }}
          </HealthRequest>
        </Flex>

        <Flex>
          <ReleasesRequest organization={organization}>
            {({loading, timeseriesData}) => {
              if (loading) return null;
              return (
                <HealthPanelChart
                  height={200}
                  title={t('Releases')}
                  series={timeseriesData}
                >
                  {props => <AreaChart {...props} />}
                </HealthPanelChart>
              );
            }}
          </ReleasesRequest>
        </Flex>

        <Flex>
          <ReleasesRequest organization={organization}>
            {({timeseriesData, loading}) => {
              if (loading) return null;
              return (
                <HealthPanelChart
                  height={200}
                  title={t('Releases')}
                  series={timeseriesData}
                >
                  {props => <PercentageBarChart {...props} />}
                </HealthPanelChart>
              );
            }}
          </ReleasesRequest>

          <HealthRequest
            tag="release"
            includeTimeseries
            interval="1d"
            showLoading
            limit={10}
            getCategory={({shortVersion}) => shortVersion}
          >
            {({timeseriesData}) => {
              return (
                <HealthPanelChart
                  height={200}
                  title={t('Releases')}
                  series={timeseriesData}
                >
                  {props => <PercentageBarChart {...props} />}
                </HealthPanelChart>
              );
            }}
          </HealthRequest>
        </Flex>

        <Flex>
          <HealthRequest
            tag="release"
            showLoading
            includeTimeseries={false}
            includeTop
            limit={5}
            topk={5}
            getCategory={({shortVersion}) => shortVersion}
          >
            {({originalTagData: data, tag}) => {
              return (
                <React.Fragment>
                  <HealthTableChart
                    headers={[t('Errors by Release')]}
                    data={data.map(row => [row, row])}
                    widths={[null, 120]}
                    getValue={item =>
                      typeof item === 'number' ? item : item && item.count}
                    renderHeaderCell={({getValue, value, columnIndex}) => {
                      return (
                        <Flex justify="space-between">
                          <ReleaseName
                            onClick={() =>
                              this.handleSetSpecifier(tag, value[tag]._health_id)}
                          >
                            {value[tag].value.shortVersion}
                          </ReleaseName>
                          <Project>
                            {value.topProjects.map(p => (
                              <IdBadge key={p.slug} project={p} />
                            ))}
                          </Project>
                        </Flex>
                      );
                    }}
                    renderDataCell={({getValue, value, columnIndex}) => {
                      return <Count value={getValue(value)} />;
                    }}
                    showRowTotal={false}
                    showColumnTotal={false}
                    shadeRowPercentage
                  />
                  <HealthPanelChart
                    height={300}
                    title={t('Errors By Release')}
                    showLegend={false}
                    series={[
                      {
                        seriesName: t('Errors By Release'),
                        data: data.map(row => ({
                          name: row.release.value.shortVersion,
                          value: row.count,
                        })),
                      },
                    ]}
                  >
                    {({series}) => (
                      <Flex>
                        <PieChartWrapper>
                          <PieChart height={300} series={series} />
                        </PieChartWrapper>
                      </Flex>
                    )}
                  </HealthPanelChart>
                </React.Fragment>
              );
            }}
          </HealthRequest>
        </Flex>
      </React.Fragment>
    );
  }
}

/**
 * This is a proof of concept, unsure if we'll want this.
 *
 * What this does is fetch the most recent releases and then make a snuba query to
 * fetch counts only for those releases.
 *
 * An alternate query is to only include the releases that contain the most error counts
 */
const ReleasesRequest = withApi(
  class ReleasesRequestComponent extends React.Component {
    static propTypes = {
      limit: PropTypes.number,
    };

    static defaultProps = {
      limit: 10,
    };

    constructor(props) {
      super(props);
      this.state = {
        data: null,
      };
    }

    async componentDidMount() {
      let {api, organization, limit} = this.props;
      if (!organization) return;

      try {
        // fetch last `limit` releases
        const releases = await api.requestPromise(
          `/organizations/${organization.slug}/releases/`,
          {
            query: {
              per_page: limit,
            },
          }
        );

        // eslint-disable-next-line
        this.setState({
          data: releases,
        });
      } catch (err) {
        addErrorMessage(t('Unable to fetch releases'));
      }
    }

    render() {
      let {children, limit, ...props} = this.props;
      let {data} = this.state;
      let loading = data === null;

      if (!data) {
        return children({
          loading,
        });
      }

      return (
        <HealthRequest
          tag="release"
          includeTimeseries
          interval="1d"
          showLoading
          limit={limit}
          getCategory={({shortVersion}) => shortVersion}
          specifiers={data.map(({version}) => `release:${version}`)}
          {...props}
        >
          {children}
        </HealthRequest>
      );
    }
  }
);

export default withHealth(OrganizationHealthErrors);
export {OrganizationHealthErrors};

const PieChartWrapper = styled(Box)`
  flex: 1;
  flex-shrink: 0;
`;

const ReleaseName = styled(Box)`
  ${overflowEllipsis};
`;

const Project = styled(Box)`
  margin-left: ${space(1)};
  flex-shrink: 0;
`;
