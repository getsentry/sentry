import React from 'react';
import * as ReactRouter from 'react-router';
import {Location} from 'history';

import {Client} from 'app/api';
import EventsChart from 'app/components/charts/eventsChart';
import {Panel} from 'app/components/panels';
import {t} from 'app/locale';
import {GlobalSelection, Organization, ReleaseMeta} from 'app/types';
import {decodeScalar} from 'app/utils/queryString';
import theme from 'app/utils/theme';

import {ReleaseStatsRequestRenderProps} from '../releaseStatsRequest';

import HealthChartContainer from './healthChartContainer';
import ReleaseChartControls, {PERFORMANCE_AXIS, YAxis} from './releaseChartControls';
import {getReleaseEventView} from './utils';

type Props = Omit<ReleaseStatsRequestRenderProps, 'crashFreeTimeBreakdown'> & {
  releaseMeta: ReleaseMeta;
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
  hasPerformance: boolean;
};

class ReleaseChartContainer extends React.Component<Props> {
  renderEventsChart() {
    const {location, router, organization, api, yAxis, selection, version} = this.props;
    const {projects, environments, datetime} = selection;
    const {start, end, period, utc} = datetime;
    const eventView = getReleaseEventView(selection, version, yAxis, organization);
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

  renderTransactionsChart() {
    const {
      location,
      router,
      organization,
      api,
      releaseMeta,
      yAxis,
      selection,
      version,
    } = this.props;
    const {projects, environments, datetime} = selection;
    const {start, end, period, utc} = datetime;
    const eventView = getReleaseEventView(selection, version, yAxis, organization);
    const apiPayload = eventView.getEventsAPIPayload(location);
    const colors =
      yAxis === YAxis.FAILED_TRANSACTIONS
        ? [theme.red300, theme.red100]
        : [theme.purple300, theme.purple100];

    const seriesNameTransformer = (name: string): string => {
      if (name === 'current') {
        return 'This Release';
      } else if (name === 'others') {
        return 'Other Releases';
      }
      return name;
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
        currentSeriesName="This Release"
        // This seems a little strange but is intentional as EventsChart
        // uses the previousSeriesName as the secondary series name
        previousSeriesName="Other Releases"
        seriesNameTransformer={seriesNameTransformer}
        disableableSeries={['This Release', 'Other Releases']}
        colors={colors}
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
    const {
      yAxis,
      hasDiscover,
      hasHealthData,
      hasPerformance,
      chartSummary,
      onYAxisChange,
      organization,
    } = this.props;

    let chart: React.ReactNode = null;
    if (hasDiscover && yAxis === YAxis.EVENTS) {
      chart = this.renderEventsChart();
    } else if (hasPerformance && PERFORMANCE_AXIS.includes(yAxis)) {
      chart = this.renderTransactionsChart();
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
