import {Component} from 'react';
import styled from '@emotion/styled';
import type {LineSeriesOption} from 'echarts';
import type {Location} from 'history';
import compact from 'lodash/compact';
import pick from 'lodash/pick';
import moment from 'moment-timezone';

import type {Client} from 'sentry/api';
import ChartZoom from 'sentry/components/charts/chartZoom';
import {LineChart} from 'sentry/components/charts/lineChart';
import SessionsRequest from 'sentry/components/charts/sessionsRequest';
import {
  HeaderTitleLegend,
  InlineContainer,
  SectionHeading,
  SectionValue,
} from 'sentry/components/charts/styles';
import TransitionChart from 'sentry/components/charts/transitionChart';
import TransparentLoadingMask from 'sentry/components/charts/transparentLoadingMask';
import {
  getDiffInMinutes,
  ONE_WEEK,
  truncationFormatter,
} from 'sentry/components/charts/utils';
import Count from 'sentry/components/count';
import type {StatsPeriodType} from 'sentry/components/organizations/pageFilters/parse';
import {
  normalizeDateTimeParams,
  parseStatsPeriod,
} from 'sentry/components/organizations/pageFilters/parse';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelFooter from 'sentry/components/panels/panelFooter';
import Placeholder from 'sentry/components/placeholder';
import {URL_PARAM} from 'sentry/constants/pageFilters';
import {t, tct, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {PageFilters} from 'sentry/types/core';
import type {EChartClickHandler} from 'sentry/types/echarts';
import type {InjectedRouter} from 'sentry/types/legacyReactRouter';
import type {Organization, SessionApiResponse} from 'sentry/types/organization';
import {decodeScalar} from 'sentry/utils/queryString';
import {getAdoptionSeries, getCount} from 'sentry/utils/sessions';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {formatVersion} from 'sentry/utils/versions/formatVersion';
import withApi from 'sentry/utils/withApi';
import {sessionDisplayToField} from 'sentry/views/releases/list/releasesRequest';

import {ReleasesDisplayOption} from './releasesDisplayOptions';

type Props = {
  activeDisplay: ReleasesDisplayOption;
  api: Client;
  location: Location;
  organization: Organization;
  router: InjectedRouter;
  selection: PageFilters;
};

class ReleasesAdoptionChart extends Component<Props> {
  // needs to have different granularity, that's why we use custom getInterval instead of getSessionsInterval
  getInterval() {
    const {organization, location} = this.props;

    const datetimeObj = {
      start: decodeScalar(location.query.start),
      end: decodeScalar(location.query.end),
      period: decodeScalar(location.query.statsPeriod),
    };

    const diffInMinutes = getDiffInMinutes(datetimeObj);

    // use high fidelity intervals when available
    // limit on backend is set to six hour
    if (
      organization.features.includes('minute-resolution-sessions') &&
      diffInMinutes < 360
    ) {
      return '10m';
    }

    if (diffInMinutes >= ONE_WEEK) {
      return '1d';
    }
    return '1h';
  }

  getReleasesSeries(response: SessionApiResponse | null) {
    const {activeDisplay} = this.props;

    // If there are many releases, display releases with the highest number of sessions
    // Often this due to many releases with low session counts or not filtering by environment
    let releases: string[] | undefined =
      response?.groups.map(group => group.by.release as string) ?? [];
    if (response?.groups && response.groups.length > 50) {
      releases = response!.groups
        .sort((a, b) => b.totals['sum(session)']! - a.totals['sum(session)']!)
        .slice(0, 50)
        .map(group => group.by.release as string);
    }

    if (!releases) {
      return null;
    }

    return releases.map(release => ({
      id: release,
      seriesName: formatVersion(release),
      data: getAdoptionSeries(
        [response?.groups.find(({by}) => by.release === release)!],
        response?.groups,
        response?.intervals,
        sessionDisplayToField(activeDisplay)
      ),
      emphasis: {
        focus: 'series',
      } as LineSeriesOption['emphasis'],
    }));
  }

  handleClick: EChartClickHandler = params => {
    const {organization, router, selection, location} = this.props;

    const project = selection.projects[0];

    router.push(
      normalizeUrl({
        pathname: `/organizations/${organization?.slug}/releases/${encodeURIComponent(
          params.seriesId
        )}/`,
        query: {project, environment: location.query.environment},
      })
    );
  };

  renderEmpty() {
    return (
      <Panel>
        <PanelBody withPadding>
          <ChartHeader>
            <Placeholder height="24px" />
          </ChartHeader>
          <Placeholder height="200px" />
        </PanelBody>
        <ChartFooter>
          <Placeholder height="34px" />
        </ChartFooter>
      </Panel>
    );
  }

  render() {
    const {activeDisplay, selection, api, organization, location} = this.props;
    const {start, end, period, utc} = selection.datetime;
    const interval = this.getInterval();
    const field = sessionDisplayToField(activeDisplay);

    return (
      <SessionsRequest
        api={api}
        organization={organization}
        interval={interval}
        groupBy={['release']}
        field={[field]}
        {...normalizeDateTimeParams(pick(location.query, Object.values(URL_PARAM)))}
      >
        {({response, loading, reloading}) => {
          const totalCount = getCount(response?.groups, field);
          const releasesSeries = this.getReleasesSeries(response);
          if (loading) {
            return this.renderEmpty();
          }

          if (!releasesSeries?.length) {
            return null;
          }

          const numDataPoints = releasesSeries[0]!.data.length;
          const xAxisData = releasesSeries[0]!.data.map(point => point.name);
          const hideLastPoint =
            releasesSeries.findIndex(
              series => series.data[numDataPoints - 1]!.value > 0
            ) === -1;

          return (
            <Panel>
              <PanelBody withPadding>
                <ChartHeader>
                  <ChartTitle>{t('Release Adoption')}</ChartTitle>
                </ChartHeader>
                <TransitionChart loading={loading} reloading={reloading}>
                  <TransparentLoadingMask visible={reloading} />
                  <ChartZoom period={period} utc={utc} start={start} end={end}>
                    {zoomRenderProps => (
                      <LineChart
                        {...zoomRenderProps}
                        grid={{left: '10px', right: '10px', top: '40px', bottom: '0px'}}
                        series={releasesSeries.map(series => ({
                          ...series,
                          data: hideLastPoint ? series.data.slice(0, -1) : series.data,
                        }))}
                        yAxis={{
                          min: 0,
                          max: 100,
                          type: 'value',
                          interval: 10,
                          splitNumber: 10,
                          axisLabel: {
                            formatter: '{value}%',
                          },
                        }}
                        xAxis={{
                          show: true,
                          min: xAxisData[0],
                          max: xAxisData[numDataPoints - 1],
                          type: 'time',
                        }}
                        tooltip={{
                          formatter: seriesParams => {
                            const series = Array.isArray(seriesParams)
                              ? seriesParams
                              : [seriesParams];
                            const timestamp = series[0].data[0];
                            const [first, second, third, ...rest] = series
                              .filter(s => s.data[1] > 0)
                              .sort((a, b) => b.data[1] - a.data[1]);

                            const restSum = rest.reduce((acc, s) => acc + s.data[1], 0);

                            const seriesToRender = compact([first, second, third]);

                            if (rest.length) {
                              seriesToRender.push({
                                seriesName: tn('%s Other', '%s Others', rest.length),
                                data: [timestamp, restSum],
                                marker:
                                  '<span style="display:inline-block;margin-right:5px;border-radius:10px;width:10px;height:10px;"></span>',
                              });
                            }

                            if (!seriesToRender.length) {
                              return '<div/>';
                            }

                            const periodObj = parseStatsPeriod(interval) || {
                              periodLength: 'd',
                              period: '1',
                            };
                            const intervalStart = moment(timestamp).format('MMM D LT');
                            const intervalEnd = (
                              series[0].dataIndex === numDataPoints - 1
                                ? moment(response?.end)
                                : moment(timestamp).add(
                                    parseInt(periodObj.period!, 10),
                                    periodObj.periodLength as StatsPeriodType
                                  )
                            ).format('MMM D LT');

                            return [
                              '<div class="tooltip-series">',
                              seriesToRender
                                .map(
                                  s =>
                                    `<div><span class="tooltip-label">${
                                      s.marker
                                    }<strong>${
                                      s.seriesName &&
                                      truncationFormatter(s.seriesName, 32)
                                    }</strong></span>${s.data[1].toFixed(2)}%</div>`
                                )
                                .join(''),
                              '</div>',
                              `<div class="tooltip-footer">${intervalStart} &mdash; ${intervalEnd}</div>`,
                              '<div class="tooltip-arrow"></div>',
                            ].join('');
                          },
                        }}
                        onClick={this.handleClick}
                      />
                    )}
                  </ChartZoom>
                </TransitionChart>
              </PanelBody>
              <ChartFooter>
                <InlineContainer>
                  <SectionHeading>
                    {tct('Total [display]', {
                      display:
                        activeDisplay === ReleasesDisplayOption.USERS
                          ? 'Users'
                          : 'Sessions',
                    })}
                  </SectionHeading>
                  <SectionValue>
                    <Count value={totalCount || 0} />
                  </SectionValue>
                </InlineContainer>
              </ChartFooter>
            </Panel>
          );
        }}
      </SessionsRequest>
    );
  }
}

export default withApi(ReleasesAdoptionChart);

const ChartHeader = styled(HeaderTitleLegend)`
  margin-bottom: ${space(1)};
`;

const ChartTitle = styled('header')`
  display: flex;
  flex-direction: row;
`;

const ChartFooter = styled(PanelFooter)`
  display: flex;
  align-items: center;
  padding: ${space(1)} 20px;
`;
