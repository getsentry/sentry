import React from 'react';
import * as ReactRouter from 'react-router';
import {Location} from 'history';

import {
  GlobalSelection,
  Organization,
  EventsStats,
  MultiSeriesEventsStats,
} from 'app/types';
import {Panel} from 'app/components/panels';
import {Client} from 'app/api';
import EventsChart from 'app/components/charts/eventsChart';
import {t} from 'app/locale';
import {decodeScalar} from 'app/utils/queryString';

import ReleaseChartControls, {YAxis} from './releaseChartControls';
import {ReleaseStatsRequestRenderProps} from '../releaseStatsRequest';
import HealthChartContainer from './healthChartContainer';
import {getReleaseEventView} from './utils';

type Props = Omit<ReleaseStatsRequestRenderProps, 'crashFreeTimeBreakdown'> & {
  selection: GlobalSelection;
  yAxis: YAxis;
  onYAxisChange: (yAxis: YAxis) => void;
  router: ReactRouter.InjectedRouter;
  organization: Organization;
  hasHealthData: boolean;
  location: Location;
  api: Client;
  version: string;
  hasDiscover: boolean;
};

class ReleaseChartContainer extends React.Component<Props> {
  renderEventsChart() {
    const {location, router, organization, api, yAxis, selection, version} = this.props;
    const {projects, environments, datetime} = selection;
    const {start, end, period, utc} = datetime;
    const eventView = getReleaseEventView(selection, version, yAxis);

    return (
      <EventsChart
        router={router}
        organization={organization}
        showLegend
        yAxis={eventView.getYAxis()}
        query={eventView.getEventsAPIPayload(location).query}
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

  mergeFailureCountResults(
    primary: EventsStats | MultiSeriesEventsStats | null,
    secondary: EventsStats | MultiSeriesEventsStats | null
  ): EventsStats | MultiSeriesEventsStats | null {
    if (primary === null || secondary === null) {
      return null;
    }

    const selfSeriesName = 'self';
    const othersSeriesName = 'others';

    const results = {
      count_others_release_failed: {
        ...secondary[othersSeriesName],
        order: 0,
      },
      count_self_release_failed: {
        ...secondary[selfSeriesName],
        order: 1,
      },
      count_others_release_passed: {
        ...primary[othersSeriesName],
        order: 2,
      },
      count_self_release_passed: {
        ...primary[selfSeriesName],
        order: 3,
      },
    };

    if (!primary.hasOwnProperty(selfSeriesName)) {
      delete results.count_self_release_passed;
    }

    if (!primary.hasOwnProperty(othersSeriesName)) {
      delete results.count_others_release_passed;
    }

    if (!secondary.hasOwnProperty(selfSeriesName)) {
      delete results.count_self_release_failed;
    }

    if (!secondary.hasOwnProperty(othersSeriesName)) {
      delete results.count_others_release_failed;
    }

    return results;
  }

  renderFailureCountChart() {
    const {location, router, organization, api, yAxis, selection, version} = this.props;
    const {projects, environments, datetime} = selection;
    const {start, end, period, utc} = datetime;
    const primaryEventView = getReleaseEventView(selection, version, yAxis);
    const primaryPayload = primaryEventView.getEventsAPIPayload(location);
    const secondaryEventView = getReleaseEventView(selection, version, yAxis, true);
    const secondaryPayload = secondaryEventView.getEventsAPIPayload(location);

    return (
      <EventsChart
        router={router}
        organization={organization}
        showLegend
        yAxis={primaryEventView.getYAxis()}
        query={primaryPayload.query}
        secondaryQuery={secondaryPayload.query}
        mergeResults={this.mergeFailureCountResults}
        api={api}
        projects={projects}
        environments={environments}
        start={start}
        end={end}
        period={period}
        utc={utc}
        disablePrevious
        disableReleases
        field={primaryPayload.field}
        topEvents={2}
        orderby={decodeScalar(primaryPayload.sort)}
        currentSeriesName={t('Failure Count')}
      />
    );
  }

  renderHealthChart() {
    const {loading, errored, reloading, chartData, selection, yAxis, router} = this.props;

    return (
      <HealthChartContainer
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
    const {yAxis, hasDiscover, hasHealthData, chartSummary, onYAxisChange} = this.props;
    // TODO(tonyx): actually get this value
    const hasPerformance = hasDiscover;

    let chart: React.ReactNode = null;
    if (hasDiscover && yAxis === YAxis.EVENTS) {
      chart = this.renderEventsChart();
    } else if (hasPerformance && yAxis === YAxis.FAILURE_COUNT) {
      chart = this.renderFailureCountChart();
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
          hasDiscover={hasDiscover}
          hasHealthData={hasHealthData}
        />
      </Panel>
    );
  }
}

export default ReleaseChartContainer;
