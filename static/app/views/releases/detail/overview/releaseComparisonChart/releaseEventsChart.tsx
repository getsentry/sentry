import {Fragment} from 'react';
import {withRouter} from 'react-router';
import {WithRouterProps} from 'react-router/lib/withRouter';
import {withTheme} from '@emotion/react';

import {Client} from 'app/api';
import EventsChart from 'app/components/charts/eventsChart';
import {HeaderTitleLegend, HeaderValue} from 'app/components/charts/styles';
import QuestionTooltip from 'app/components/questionTooltip';
import {t} from 'app/locale';
import {DateString, Organization, ReleaseComparisonChartType} from 'app/types';
import {Theme} from 'app/utils/theme';
import {QueryResults} from 'app/utils/tokenizeSearch';
import withApi from 'app/utils/withApi';
import withOrganization from 'app/utils/withOrganization';
import {getTermHelp, PERFORMANCE_TERM} from 'app/views/performance/data';

import {releaseComparisonChartLabels} from '../../utils';

type Props = WithRouterProps & {
  version: string;
  chartType: ReleaseComparisonChartType;
  value: React.ReactNode;
  diff: React.ReactNode;
  theme: Theme;
  organization: Organization;
  api: Client;
  period?: string;
  start?: string;
  end?: string;
  utc?: boolean;
};

function ReleaseEventsChart({
  version,
  chartType,
  value,
  diff,
  theme,
  organization,
  api,
  router,
  period,
  start,
  end,
  utc,
  location,
}: Props) {
  function getColors() {
    const colors = theme.charts.getColorPalette(14);
    switch (chartType) {
      case ReleaseComparisonChartType.ERROR_COUNT:
        return [colors[12]];
      case ReleaseComparisonChartType.TRANSACTION_COUNT:
        return [theme.gray300];
      case ReleaseComparisonChartType.FAILURE_RATE:
        return [colors[9]];
      default:
        return undefined;
    }
  }

  function getQuery() {
    const releaseFilter = `release:${version}`;

    switch (chartType) {
      case ReleaseComparisonChartType.ERROR_COUNT:
        return new QueryResults([
          '!event.type:transaction',
          releaseFilter,
        ]).formatString();
      case ReleaseComparisonChartType.TRANSACTION_COUNT:
        return new QueryResults(['event.type:transaction', releaseFilter]).formatString();
      case ReleaseComparisonChartType.FAILURE_RATE:
        return new QueryResults(['event.type:transaction', releaseFilter]).formatString();
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
        return getTermHelp(organization, PERFORMANCE_TERM.FAILURE_RATE);
      default:
        return null;
    }
  }

  const projects = location.query.project;
  const environments = location.query.environment;

  return (
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
      environments={environments}
      start={start as DateString}
      end={end as DateString}
      period={period ?? undefined}
      utc={utc}
      currentSeriesName={t('This Release')}
      previousSeriesName={t('All Releases')}
      disableableSeries={[t('This Release'), t('All Releases')]}
      chartHeader={
        <Fragment>
          <HeaderTitleLegend>
            {releaseComparisonChartLabels[chartType]}
            {getHelp() && <QuestionTooltip size="sm" position="top" title={getHelp()} />}
          </HeaderTitleLegend>

          <HeaderValue>
            {value} {diff}
          </HeaderValue>
        </Fragment>
      }
      legendOptions={{right: 10, top: 0}}
      chartOptions={{
        grid: {left: '10px', right: '10px', top: '70px', bottom: '0px'},
        ['height' as any]: 240, // TODO(ts): echart types
      }}
      usePageZoom
    />
  );
}

export default withOrganization(withTheme(withRouter(withApi(ReleaseEventsChart))));
