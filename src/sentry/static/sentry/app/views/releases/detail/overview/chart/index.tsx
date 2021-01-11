import React from 'react';
import * as ReactRouter from 'react-router';
import {withTheme} from 'emotion-theming';
import {Location} from 'history';

import {Client} from 'app/api';
import EventsChart from 'app/components/charts/eventsChart';
import {Panel} from 'app/components/panels';
import QuestionTooltip from 'app/components/questionTooltip';
import {PlatformKey} from 'app/data/platformCategories';
import {t} from 'app/locale';
import {GlobalSelection, Organization, ReleaseMeta} from 'app/types';
import {WebVital} from 'app/utils/discover/fields';
import {decodeScalar} from 'app/utils/queryString';
import {Theme} from 'app/utils/theme';
import {getTermHelp} from 'app/views/performance/data';
import {ChartContainer, HeaderTitleLegend} from 'app/views/performance/styles';

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
};

class ReleaseChartContainer extends React.Component<Props> {
  getTransactionsChartColors(): [string, string] {
    const {yAxis, theme} = this.props;

    switch (yAxis) {
      case YAxis.FAILED_TRANSACTIONS:
        return [theme.red300, theme.red100];
      default:
        return [theme.purple300, theme.purple100];
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
          help: getTermHelp(organization, 'failureRate'),
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

  seriesNameTransformer(name: string): string {
    switch (name) {
      case 'current':
        return t('This Release');
      case 'others':
        return t('Other Releases');
      default:
        return name;
    }
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
        seriesNameTransformer={this.seriesNameTransformer}
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
      chartSummary,
      onYAxisChange,
      onEventTypeChange,
      onVitalTypeChange,
      organization,
    } = this.props;

    let chart: React.ReactNode = null;
    if (
      (hasDiscover && yAxis === YAxis.EVENTS) ||
      (hasPerformance && PERFORMANCE_AXIS.includes(yAxis))
    ) {
      chart = this.renderStackedChart();
    } else {
      chart = this.renderHealthChart();
    }

    return (
      <Panel>
        <ChartContainer>{chart}</ChartContainer>
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
    );
  }
}

export default withTheme(ReleaseChartContainer);
