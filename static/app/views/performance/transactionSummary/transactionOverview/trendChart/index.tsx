import {Fragment} from 'react';
// eslint-disable-next-line no-restricted-imports
import {browserHistory, withRouter, WithRouterProps} from 'react-router';
import {useTheme} from '@emotion/react';
import {Location, Query} from 'history';

import EventsRequest from 'sentry/components/charts/eventsRequest';
import {HeaderTitleLegend} from 'sentry/components/charts/styles';
import {getInterval, getSeriesSelection} from 'sentry/components/charts/utils';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {t} from 'sentry/locale';
import {OrganizationSummary} from 'sentry/types';
import {getUtcToLocalDateObject} from 'sentry/utils/dates';
import useApi from 'sentry/utils/useApi';

import {TrendFunctionField} from '../../../trends/types';
import {generateTrendFunctionAsString} from '../../../trends/utils';
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

  function handleLegendSelectChanged(legendChange: {
    name: string;
    selected: Record<string, boolean>;
    type: string;
  }) {
    const {selected} = legendChange;
    const unselected = Object.keys(selected).filter(key => !selected[key]);

    const to = {
      ...location,
      query: {
        ...location.query,
        unselectedSeries: unselected,
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
    selected: getSeriesSelection(location),
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
        title={t('Trends shows the smoothed value of an aggregate over time.')}
      />
    </HeaderTitleLegend>
  );

  const trendDisplay = generateTrendFunctionAsString(trendFunction, trendParameter);

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
