import {Fragment} from 'react';
import {browserHistory, withRouter, WithRouterProps} from 'react-router';
import {useTheme} from '@emotion/react';
import {Location, Query} from 'history';

import ErrorPanel from 'sentry/components/charts/errorPanel';
import EventsRequest from 'sentry/components/charts/eventsRequest';
import {HeaderTitleLegend} from 'sentry/components/charts/styles';
import {getInterval, getSeriesSelection} from 'sentry/components/charts/utils';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {t} from 'sentry/locale';
import {OrganizationSummary} from 'sentry/types';
import {getUtcToLocalDateObject} from 'sentry/utils/dates';
import MetricsRequest from 'sentry/utils/metrics/metricsRequest';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useApi from 'sentry/utils/useApi';
import {useMetricsSwitch} from 'sentry/views/performance/metricsSwitch';

import {transformMetricsToArea} from '../../../landing/widgets/transforms/transformMetricsToArea';
import {TrendFunctionField} from '../../../trends/types';
import {
  generateTrendFunctionAsString,
  trendParameterToMetricsField,
} from '../../../trends/utils';
import {ViewProps} from '../../../types';

import Content from './content';

type Props = WithRouterProps &
  ViewProps & {
    location: Location;
    organization: OrganizationSummary;
    queryExtra: Query;
    trendFunction: TrendFunctionField;
    trendParameter: string;
    withoutZerofill: boolean;
  };

function TrendChart({
  project,
  environment,
  location,
  organization,
  query,
  statsPeriod,
  router,
  trendFunction,
  trendParameter,
  queryExtra,
  withoutZerofill,
  start: propsStart,
  end: propsEnd,
}: Props) {
  const api = useApi();
  const theme = useTheme();
  const {isMetricsData} = useMetricsSwitch();

  function handleLegendSelectChanged(legendChange: {
    name: string;
    type: string;
    selected: Record<string, boolean>;
  }) {
    const {selected} = legendChange;
    const unselected = Object.keys(selected).filter(key => !selected[key]);

    const to = {
      ...location,
      query: {
        ...location.query,
        trendsUnselectedSeries: unselected,
      },
    };
    browserHistory.push(to);
  }

  const start = propsStart ? getUtcToLocalDateObject(propsStart) : null;
  const end = propsEnd ? getUtcToLocalDateObject(propsEnd) : null;
  const utc = normalizeDateTimeParams(location.query)?.utc === 'true';
  const period = statsPeriod;

  const legend = {
    right: 10,
    top: 0,
    selected: getSeriesSelection(location, 'trendsUnselectedSeries'),
  };

  const datetimeSelection = {start, end, period};

  const contentCommonProps = {
    theme,
    router,
    start,
    end,
    utc,
    legend,
    queryExtra,
    period,
    projects: project,
    environments: environment,
    onLegendSelectChanged: handleLegendSelectChanged,
  };

  const requestCommonProps = {
    api,
    start,
    end,
    project,
    environment,
    query,
    period,
    interval: getInterval(datetimeSelection, 'high'),
  };

  const header = (
    <HeaderTitleLegend>
      {t('Trend')}
      <QuestionTooltip
        size="sm"
        position="top"
        title={t(`Trends shows the smoothed value of an aggregate over time.`)}
      />
    </HeaderTitleLegend>
  );

  const trendDisplay = generateTrendFunctionAsString(trendFunction, trendParameter);

  if (isMetricsData) {
    const parameter = trendParameterToMetricsField[trendParameter];

    if (!parameter) {
      return (
        <Fragment>
          {header}
          <ErrorPanel>{`TODO: ${trendDisplay}`}</ErrorPanel>
        </Fragment>
      );
    }

    const field = `${trendFunction}(${parameter})`;

    return (
      <Fragment>
        {header}
        <MetricsRequest
          {...requestCommonProps}
          query={new MutableSearch(query).formatString()} // TODO(metrics): not all tags will be compatible with metrics
          orgSlug={organization.slug}
          field={[field]}
        >
          {trendRequestResponseProps => {
            const {errored, loading, reloading} = trendRequestResponseProps;

            const trendData = transformMetricsToArea(
              {
                location,
                fields: [field],
              },
              trendRequestResponseProps
            );

            return (
              <Content
                series={trendData.data}
                errored={errored}
                loading={loading}
                reloading={reloading}
                {...contentCommonProps}
              />
            );
          }}
        </MetricsRequest>
      </Fragment>
    );
  }

  return (
    <Fragment>
      {header}
      <EventsRequest
        {...requestCommonProps}
        organization={organization}
        showLoading={false}
        includePrevious={false}
        yAxis={trendDisplay}
        currentSeriesNames={[trendDisplay]}
        partial
        withoutZerofill={withoutZerofill}
        referrer="api.performance.transaction-summary.trends-chart"
      >
        {({errored, loading, reloading, timeseriesData, timeframe: timeFrame}) => (
          <Content
            series={timeseriesData}
            errored={errored}
            loading={loading}
            reloading={reloading}
            timeFrame={timeFrame}
            {...contentCommonProps}
          />
        )}
      </EventsRequest>
    </Fragment>
  );
}

export default withRouter(TrendChart);
