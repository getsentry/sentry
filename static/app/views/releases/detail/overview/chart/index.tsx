import React from 'react';
import * as ReactRouter from 'react-router';
import styled from '@emotion/styled';
import {withTheme} from 'emotion-theming';
import {Location} from 'history';

import {Client} from 'app/api';
import GuideAnchor from 'app/components/assistant/guideAnchor';
import EventsChart from 'app/components/charts/eventsChart';
import {ChartContainer, HeaderTitleLegend} from 'app/components/charts/styles';
import {Panel} from 'app/components/panels';
import QuestionTooltip from 'app/components/questionTooltip';
import {PlatformKey} from 'app/data/platformCategories';
import {t} from 'app/locale';
import {GlobalSelection, Organization, ReleaseMeta} from 'app/types';
import {Series} from 'app/types/echarts';
import {WebVital} from 'app/utils/discover/fields';
import {decodeScalar} from 'app/utils/queryString';
import {Theme} from 'app/utils/theme';
import {getTermHelp, PERFORMANCE_TERM} from 'app/views/performance/data';

import ReleaseStatsRequest from '../releaseStatsRequest';

import HealthChartContainer from './healthChartContainer';
import ReleaseChartControls, {
  EventType,
  PERFORMANCE_AXIS,
  YAxis,
} from './releaseChartControls';
import {getReleaseEventView} from './utils';

type Props = {
  releaseMeta: ReleaseMeta;
  selection: GlobalSelection;
  platform: PlatformKey;
  yAxis: YAxis;
  eventType: EventType;
  vitalType: WebVital;
  onYAxisChange: (yAxis: YAxis) => void;
  onEventTypeChange: (eventType: EventType) => void;
  onVitalTypeChange: (vitalType: WebVital) => void;
  router: ReactRouter.InjectedRouter;
  organization: Organization;
  hasHealthData: boolean;
  location: Location;
  api: Client;
  version: string;
  hasDiscover: boolean;
  hasPerformance: boolean;
  theme: Theme;
  defaultStatsPeriod: string;
  projectSlug: string;
};

class ReleaseChartContainer extends React.Component<Props> {
  /**
   * This returns an array with 3 colors, one for each of
   * 1. This Release
   * 2. Other Releases
   * 3. Releases (the markers)
   */
  getTransactionsChartColors(): [string, string, string] {
    const {yAxis, theme} = this.props;

    switch (yAxis) {
      case YAxis.FAILED_TRANSACTIONS:
        return [theme.red300, theme.red100, theme.purple300];
      default:
        return [theme.purple300, theme.purple100, theme.purple300];
    }
  }

  getChartTitle() {
    const {yAxis, organization} = this.props;

    switch (yAxis) {
      case YAxis.SESSIONS:
        return {
          title: t('Session Count'),
          help: t('The number of sessions in a given period.'),
        };
      case YAxis.USERS:
        return {
          title: t('User Count'),
          help: t('The number of users in a given period.'),
        };
      case YAxis.SESSION_DURATION:
        return {title: t('Session Duration')};
      case YAxis.CRASH_FREE:
        return {title: t('Crash Free Rate')};
      case YAxis.FAILED_TRANSACTIONS:
        return {
          title: t('Failure Count'),
          help: getTermHelp(organization, PERFORMANCE_TERM.FAILURE_RATE),
        };
      case YAxis.COUNT_DURATION:
        return {title: t('Slow Duration Count')};
      case YAxis.COUNT_VITAL:
        return {title: t('Slow Vital Count')};
      case YAxis.EVENTS:
      default:
        return {title: t('Event Count')};
    }
  }

  cloneSeriesAsZero(series: Series): Series {
    return {
      ...series,
      data: series.data.map(point => ({
        ...point,
        value: 0,
      })),
    };
  }

  /**
   * The top events endpoint used to generate these series is not guaranteed to return a series
   * for both the current release and the other releases. This happens when there is insufficient
   * data. In these cases, the endpoint will return a single zerofilled series for the current
   * release.
   *
   * This is problematic as we want to show both series even if one is empty. To deal with this,
   * we clone the non empty series (to preserve the timestamps) with value 0 (to represent the
   * lack of data).
   */
  seriesTransformer = (series: Series[]): Series[] => {
    let current: Series | null = null;
    let others: Series | null = null;
    const allSeries: Series[] = [];
    series.forEach(s => {
      if (s.seriesName === 'current' || s.seriesName === t('This Release')) {
        current = s;
      } else if (s.seriesName === 'others' || s.seriesName === t('Other Releases')) {
        others = s;
      } else {
        allSeries.push(s);
      }
    });

    if (current !== null && others === null) {
      others = this.cloneSeriesAsZero(current);
    } else if (current === null && others !== null) {
      current = this.cloneSeriesAsZero(others);
    }

    if (others !== null) {
      others.seriesName = t('Other Releases');
      allSeries.unshift(others);
    }

    if (current !== null) {
      current.seriesName = t('This Release');
      allSeries.unshift(current);
    }

    return allSeries;
  };

  renderStackedChart() {
    const {
      location,
      router,
      organization,
      api,
      releaseMeta,
      yAxis,
      eventType,
      vitalType,
      selection,
      version,
    } = this.props;
    const {projects, environments, datetime} = selection;
    const {start, end, period, utc} = datetime;
    const eventView = getReleaseEventView(
      selection,
      version,
      yAxis,
      eventType,
      vitalType,
      organization
    );
    const apiPayload = eventView.getEventsAPIPayload(location);
    const colors = this.getTransactionsChartColors();
    const {title, help} = this.getChartTitle();

    const releaseQueryExtra = {
      showTransactions: location.query.showTransactions,
      eventType,
      vitalType,
      yAxis,
    };

    return (
      <EventsChart
        router={router}
        organization={organization}
        showLegend
        yAxis={eventView.getYAxis()}
        query={apiPayload.query}
        api={api}
        projects={projects}
        environments={environments}
        start={start}
        end={end}
        period={period}
        utc={utc}
        disablePrevious
        emphasizeReleases={[releaseMeta.version]}
        field={eventView.getFields()}
        topEvents={2}
        orderby={decodeScalar(apiPayload.sort)}
        currentSeriesName={t('This Release')}
        // This seems a little strange but is intentional as EventsChart
        // uses the previousSeriesName as the secondary series name
        previousSeriesName={t('Other Releases')}
        seriesTransformer={this.seriesTransformer}
        disableableSeries={[t('This Release'), t('Other Releases')]}
        colors={colors}
        preserveReleaseQueryParams
        releaseQueryExtra={releaseQueryExtra}
        chartHeader={
          <HeaderTitleLegend>
            {title}
            {help && <QuestionTooltip size="sm" position="top" title={help} />}
          </HeaderTitleLegend>
        }
        legendOptions={{right: 10, top: 0}}
        chartOptions={{grid: {left: '10px', right: '10px', top: '40px', bottom: '0px'}}}
      />
    );
  }

  renderHealthChart(
    loading: boolean,
    reloading: boolean,
    errored: boolean,
    chartData: Series[]
  ) {
    const {selection, yAxis, router, platform} = this.props;
    const {title, help} = this.getChartTitle();

    return (
      <HealthChartContainer
        platform={platform}
        loading={loading}
        errored={errored}
        reloading={reloading}
        chartData={chartData}
        selection={selection}
        yAxis={yAxis}
        router={router}
        title={title}
        help={help}
      />
    );
  }

  render() {
    const {
      yAxis,
      eventType,
      vitalType,
      hasDiscover,
      hasHealthData,
      hasPerformance,
      onYAxisChange,
      onEventTypeChange,
      onVitalTypeChange,
      organization,
      defaultStatsPeriod,
      api,
      version,
      selection,
      location,
      projectSlug,
    } = this.props;

    return (
      <ReleaseStatsRequest
        api={api}
        organization={organization}
        projectSlug={projectSlug}
        version={version}
        selection={selection}
        location={location}
        yAxis={yAxis}
        eventType={eventType}
        vitalType={vitalType}
        hasHealthData={hasHealthData}
        hasDiscover={hasDiscover}
        hasPerformance={hasPerformance}
        defaultStatsPeriod={defaultStatsPeriod}
      >
        {({loading, reloading, errored, chartData, chartSummary}) => (
          <Panel>
            <ChartContainer>
              {((hasDiscover || hasPerformance) && yAxis === YAxis.EVENTS) ||
              (hasPerformance && PERFORMANCE_AXIS.includes(yAxis))
                ? this.renderStackedChart()
                : this.renderHealthChart(loading, reloading, errored, chartData)}
            </ChartContainer>
            <AnchorWrapper>
              <GuideAnchor target="release_chart" position="bottom" offset="-80px">
                <React.Fragment />
              </GuideAnchor>
            </AnchorWrapper>
            <ReleaseChartControls
              summary={chartSummary}
              yAxis={yAxis}
              onYAxisChange={onYAxisChange}
              eventType={eventType}
              onEventTypeChange={onEventTypeChange}
              vitalType={vitalType}
              onVitalTypeChange={onVitalTypeChange}
              organization={organization}
              hasDiscover={hasDiscover}
              hasHealthData={hasHealthData}
              hasPerformance={hasPerformance}
            />
          </Panel>
        )}
      </ReleaseStatsRequest>
    );
  }
}

export default withTheme(ReleaseChartContainer);

const AnchorWrapper = styled('div')`
  height: 0;
  width: 0;
  margin-left: 50%;
`;
