import React from 'react';
import * as ReactRouter from 'react-router';
import {Location} from 'history';

import {GlobalSelection, Organization} from 'app/types';
import {Panel} from 'app/components/panels';
import {Client} from 'app/api';
import EventsChart from 'app/components/charts/eventsChart';
import {t} from 'app/locale';

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

const ReleaseChartContainer = ({
  loading,
  errored,
  reloading,
  chartData,
  chartSummary,
  selection,
  yAxis,
  onYAxisChange,
  router,
  organization,
  hasHealthData,
  location,
  api,
  version,
  hasDiscover,
}: Props) => {
  const {projects, environments, datetime} = selection;
  const {start, end, period, utc} = datetime;
  const eventView = getReleaseEventView(selection, version);

  return (
    <Panel>
      {hasDiscover && yAxis === YAxis.EVENTS ? (
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
      ) : (
        <HealthChartContainer
          loading={loading}
          errored={errored}
          reloading={reloading}
          chartData={chartData}
          selection={selection}
          yAxis={yAxis}
          router={router}
        />
      )}

      <ReleaseChartControls
        summary={chartSummary}
        yAxis={yAxis}
        onYAxisChange={onYAxisChange}
        hasDiscover={hasDiscover}
        hasHealthData={hasHealthData}
      />
    </Panel>
  );
};

export default ReleaseChartContainer;
