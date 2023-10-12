import {Fragment} from 'react';
import {useTheme} from '@emotion/react';
import type {ToolboxComponentOption} from 'echarts';

import {Client} from 'sentry/api';
import EventsChart from 'sentry/components/charts/eventsChart';
import EventsRequest from 'sentry/components/charts/eventsRequest';
import {HeaderTitleLegend, HeaderValue} from 'sentry/components/charts/styles';
import {getInterval} from 'sentry/components/charts/utils';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {t} from 'sentry/locale';
import {
  Organization,
  ReleaseComparisonChartType,
  ReleaseProject,
  ReleaseWithHealth,
} from 'sentry/types';
import {tooltipFormatter} from 'sentry/utils/discover/charts';
import EventView from 'sentry/utils/discover/eventView';
import {aggregateOutputType} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import useRouter from 'sentry/utils/useRouter';
import withOrganization from 'sentry/utils/withOrganization';
import {getTermHelp, PerformanceTerm} from 'sentry/views/performance/data';

import {
  generateReleaseMarkLines,
  releaseComparisonChartTitles,
  releaseMarkLinesLabels,
} from '../../utils';

type Props = {
  chartType: ReleaseComparisonChartType;
  diff: React.ReactNode;
  organization: Organization;
  project: ReleaseProject;
  release: ReleaseWithHealth;
  value: React.ReactNode;
  end?: string;
  period?: string | null;
  start?: string;
  utc?: boolean;
};

function ReleaseEventsChart({
  release,
  project,
  chartType,
  value,
  diff,
  organization,
  period,
  start,
  end,
  utc,
}: Props) {
  const location = useLocation();
  const router = useRouter();
  const api = useApi();
  const theme = useTheme();

  function getColors() {
    const colors = theme.charts.getColorPalette(14);
    switch (chartType) {
      case ReleaseComparisonChartType.ERROR_COUNT:
        return [colors[12]];
      case ReleaseComparisonChartType.TRANSACTION_COUNT:
        return [colors[0]];
      case ReleaseComparisonChartType.FAILURE_RATE:
        return [colors[9]];
      default:
        return undefined;
    }
  }

  function getQuery() {
    const releaseFilter = `release:${release.version}`;

    switch (chartType) {
      case ReleaseComparisonChartType.ERROR_COUNT:
        return new MutableSearch(['event.type:error', releaseFilter]).formatString();
      case ReleaseComparisonChartType.TRANSACTION_COUNT:
        return new MutableSearch([
          'event.type:transaction',
          releaseFilter,
        ]).formatString();
      case ReleaseComparisonChartType.FAILURE_RATE:
        return new MutableSearch([
          'event.type:transaction',
          releaseFilter,
        ]).formatString();
      default:
        return '';
    }
  }

  function getField() {
    switch (chartType) {
      case ReleaseComparisonChartType.ERROR_COUNT:
        return ['count()'];
      case ReleaseComparisonChartType.TRANSACTION_COUNT:
        return ['count()'];
      case ReleaseComparisonChartType.FAILURE_RATE:
        return ['failure_rate()'];
      default:
        return undefined;
    }
  }

  function getYAxis() {
    switch (chartType) {
      case ReleaseComparisonChartType.ERROR_COUNT:
        return 'count()';
      case ReleaseComparisonChartType.TRANSACTION_COUNT:
        return 'count()';
      case ReleaseComparisonChartType.FAILURE_RATE:
        return 'failure_rate()';
      default:
        return '';
    }
  }

  function getHelp() {
    switch (chartType) {
      case ReleaseComparisonChartType.FAILURE_RATE:
        return getTermHelp(organization, PerformanceTerm.FAILURE_RATE);
      default:
        return null;
    }
  }

  const eventView = EventView.fromSavedQueryOrLocation(undefined, location);
  const projects = eventView.project as number[];
  const environments = eventView.environment as string[];
  const markLines = generateReleaseMarkLines(release, project, theme, location);

  return (
    /**
     * EventsRequest is used to fetch the second series of Failure Rate chart.
     * First one is "This Release" - fetched as usual inside EventsChart
     * component and this one is "All Releases" that's shoehorned in place
     * of Previous Period via previousSeriesTransformer
     */
    <EventsRequest
      organization={organization}
      api={new Client()}
      period={period}
      project={projects}
      environment={environments}
      start={start}
      end={end}
      interval={getInterval({start, end, period, utc}, 'high')}
      query="event.type:transaction"
      includePrevious={false}
      currentSeriesNames={[t('All Releases')]}
      yAxis={getYAxis()}
      field={getField()}
      confirmedQuery={chartType === ReleaseComparisonChartType.FAILURE_RATE}
      partial
      referrer="api.releases.release-details-chart"
    >
      {({timeseriesData, loading, reloading}) => (
        <EventsChart
          query={getQuery()}
          yAxis={getYAxis()}
          field={getField()}
          colors={getColors()}
          api={api}
          router={router}
          organization={organization}
          disableReleases
          disablePrevious
          showLegend
          projects={projects}
          dataset={DiscoverDatasets.METRICS_ENHANCED}
          environments={environments}
          start={start ?? null}
          end={end ?? null}
          period={period}
          utc={utc}
          currentSeriesName={t('This Release') + (loading || reloading ? ' ' : '')} // HACK: trigger echarts rerender without remounting
          previousSeriesName={t('All Releases')}
          disableableSeries={[t('This Release'), t('All Releases')]}
          chartHeader={
            <Fragment>
              <HeaderTitleLegend>
                {releaseComparisonChartTitles[chartType]}
                {getHelp() && (
                  <QuestionTooltip size="sm" position="top" title={getHelp()} />
                )}
              </HeaderTitleLegend>

              <HeaderValue>
                {value} {diff}
              </HeaderValue>
            </Fragment>
          }
          legendOptions={{
            right: 10,
            top: 0,
            textStyle: {
              padding: [2, 0, 0, 0],
            },
          }}
          chartOptions={{
            grid: {left: '10px', right: '10px', top: '70px', bottom: '0px'},
            tooltip: {
              trigger: 'axis',
              truncate: 80,
              valueFormatter: (val: number, label?: string) => {
                if (label && Object.values(releaseMarkLinesLabels).includes(label)) {
                  return '';
                }

                return tooltipFormatter(val, aggregateOutputType(getYAxis()));
              },
            } as ToolboxComponentOption,
          }}
          usePageZoom
          height={240}
          seriesTransformer={series => [...series, ...markLines]}
          previousSeriesTransformer={series => {
            if (chartType === ReleaseComparisonChartType.FAILURE_RATE) {
              return timeseriesData?.[0];
            }
            return series;
          }}
          referrer="api.releases.release-details-chart"
        />
      )}
    </EventsRequest>
  );
}

export default withOrganization(ReleaseEventsChart);
