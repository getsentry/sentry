import {Fragment} from 'react';
import {browserHistory} from 'react-router';
import {useTheme} from '@emotion/react';
import {Query} from 'history';

import EventsRequest from 'sentry/components/charts/eventsRequest';
import {HeaderTitleLegend} from 'sentry/components/charts/styles';
import {getInterval, getSeriesSelection} from 'sentry/components/charts/utils';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {t} from 'sentry/locale';
import {OrganizationSummary} from 'sentry/types';
import {getUtcToLocalDateObject} from 'sentry/utils/dates';
import {getAggregateArg, getMeasurementSlug} from 'sentry/utils/discover/fields';
import {WebVital} from 'sentry/utils/fields';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import useRouter from 'sentry/utils/useRouter';

import {ViewProps} from '../../../types';

import Content from './content';

type Props = ViewProps & {
  organization: OrganizationSummary;
  queryExtra: Query;
  withoutZerofill: boolean;
  queryExtras?: Record<string, string>;
};

function VitalsChart({
  project,
  environment,
  organization,
  query,
  statsPeriod,
  queryExtra,
  withoutZerofill,
  start: propsStart,
  end: propsEnd,
  queryExtras,
}: Props) {
  const location = useLocation();
  const router = useRouter();
  const api = useApi();
  const theme = useTheme();

  const handleLegendSelectChanged = (legendChange: {
    name: string;
    selected: Record<string, boolean>;
    type: string;
  }) => {
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
  };

  const vitals = [WebVital.FCP, WebVital.LCP, WebVital.FID, WebVital.CLS];
  const start = propsStart ? getUtcToLocalDateObject(propsStart) : null;
  const end = propsEnd ? getUtcToLocalDateObject(propsEnd) : null;
  const utc = normalizeDateTimeParams(location.query).utc === 'true';
  const period = statsPeriod;

  const legend = {
    right: 10,
    top: 0,
    selected: getSeriesSelection(location),
    formatter: (seriesName: string) => {
      const arg = getAggregateArg(seriesName);
      if (arg !== null) {
        const slug = getMeasurementSlug(arg);
        if (slug !== null) {
          seriesName = slug.toUpperCase();
        }
      }
      return seriesName;
    },
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
      {t('Web Vitals Breakdown')}
      <QuestionTooltip
        size="sm"
        position="top"
        title={t(
          `Web Vitals Breakdown reflects the 75th percentile of web vitals over time.`
        )}
      />
    </HeaderTitleLegend>
  );

  const yAxis = vitals.map(v => `p75(${v})`);

  return (
    <Fragment>
      {header}
      <EventsRequest
        {...requestCommonProps}
        organization={organization}
        showLoading={false}
        includePrevious={false}
        yAxis={yAxis}
        partial
        withoutZerofill={withoutZerofill}
        referrer="api.performance.transaction-summary.vitals-chart"
        queryExtras={queryExtras}
      >
        {({results, errored, loading, reloading, timeframe: timeFrame}) => (
          <Content
            series={results}
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

export default VitalsChart;
