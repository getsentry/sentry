import React from 'react';
import * as ReactRouter from 'react-router';
import {Location} from 'history';

import {Client} from 'app/api';
import EventsChart from 'app/components/charts/eventsChart';
import {Panel} from 'app/components/panels';
import {PlatformKey} from 'app/data/platformCategories';
import {t} from 'app/locale';
import {GlobalSelection, Organization, ReleaseMeta} from 'app/types';
import {decodeScalar} from 'app/utils/queryString';
import theme from 'app/utils/theme';

import {ReleaseStatsRequestRenderProps} from '../releaseStatsRequest';

import HealthChartContainer from './healthChartContainer';
import ReleaseChartControls, {
  EventType,
  PERFORMANCE_AXIS,
  YAxis,
} from './releaseChartControls';
import {getReleaseEventView} from './utils';

type Props = Omit<ReleaseStatsRequestRenderProps, 'crashFreeTimeBreakdown'> & {
  releaseMeta: ReleaseMeta;
  selection: GlobalSelection;
  platform: PlatformKey;
  yAxis: YAxis;
  eventType: EventType;
  onYAxisChange: (yAxis: YAxis) => void;
  onEventTypeChange: (eventType: EventType) => void;
  router: ReactRouter.InjectedRouter;
  organization: Organization;
  hasHealthData: boolean;
  location: Location;
  api: Client;
  version: string;
  hasDiscover: boolean;
  hasPerformance: boolean;
};

class ReleaseChartContainer extends React.Component<Props> {
  // TODO(tonyx): Delete this else once the feature flags are removed
  renderEventsChart() {
    const {location, router, organization, api, yAxis, selection, version} = this.props;
    const {projects, environments, datetime} = selection;
    const {start, end, period, utc} = datetime;
    const eventView = getReleaseEventView(
      selection,
      version,
      yAxis,
      undefined,
      organization
    );
    const apiPayload = eventView.getEventsAPIPayload(location);

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
        disableReleases
        currentSeriesName={t('Events')}
      />
    );
  }

  getTransactionsChartColors(): [string, string] {
    const {yAxis} = this.props;

    switch (yAxis) {
      case YAxis.FAILED_TRANSACTIONS:
        return [theme.red300, theme.red100];
      default:
        return [theme.purple300, theme.purple100];
    }
  }

  seriesNameTransformer(name: string): string {
    if (name === 'current') {
      return t('This Release');
    } else if (name === 'others') {
      return t('Other Releases');
    }
    return name;
  }

  renderStackedChart() {
    const {
      location,
      router,
      organization,
      api,
      releaseMeta,
      yAxis,
      eventType,
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
      organization
    );
    const apiPayload = eventView.getEventsAPIPayload(location);
    const colors = this.getTransactionsChartColors();

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
        seriesNameTransformer={this.seriesNameTransformer}
        disableableSeries={[t('This Release'), t('Other Releases')]}
        colors={colors}
      />
    );
  }

  renderHealthChart() {
    const {
      loading,
      errored,
      reloading,
      chartData,
      selection,
      yAxis,
      router,
      platform,
    } = this.props;

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
      />
    );
  }

  render() {
    const {
      yAxis,
      eventType,
      hasDiscover,
      hasHealthData,
      hasPerformance,
      chartSummary,
      onYAxisChange,
      onEventTypeChange,
      organization,
    } = this.props;

    let chart: React.ReactNode = null;
    if (
      hasDiscover &&
      yAxis === YAxis.EVENTS &&
      !organization.features.includes('release-performance-views')
    ) {
      chart = this.renderEventsChart();
    } else if (
      (hasDiscover && yAxis === YAxis.EVENTS) ||
      (hasPerformance && PERFORMANCE_AXIS.includes(yAxis))
    ) {
      chart = this.renderStackedChart();
    } else {
      chart = this.renderHealthChart();
    }

    return (
      <Panel>
        {chart}
        <ReleaseChartControls
          summary={chartSummary}
          yAxis={yAxis}
          onYAxisChange={onYAxisChange}
          eventType={eventType}
          onEventTypeChange={onEventTypeChange}
          organization={organization}
          hasDiscover={hasDiscover}
          hasHealthData={hasHealthData}
          hasPerformance={hasPerformance}
        />
      </Panel>
    );
  }
}

export default ReleaseChartContainer;
