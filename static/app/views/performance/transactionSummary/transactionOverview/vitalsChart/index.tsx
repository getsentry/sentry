import {Fragment} from 'react';
import {browserHistory, withRouter, WithRouterProps} from 'react-router';
import {useTheme} from '@emotion/react';
import {Location} from 'history';

import EventsRequest from 'sentry/components/charts/eventsRequest';
import {HeaderTitleLegend} from 'sentry/components/charts/styles';
import {getInterval, getSeriesSelection} from 'sentry/components/charts/utils';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {t} from 'sentry/locale';
import {OrganizationSummary} from 'sentry/types';
import {getUtcToLocalDateObject} from 'sentry/utils/dates';
import EventView from 'sentry/utils/discover/eventView';
import {
  getAggregateArg,
  getMeasurementSlug,
  WebVital,
} from 'sentry/utils/discover/fields';
import MetricsRequest from 'sentry/utils/metrics/metricsRequest';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useApi from 'sentry/utils/useApi';
import {PerformanceWidgetSetting} from 'sentry/views/performance/landing/widgets/widgetDefinitions';
import {useMetricsSwitch} from 'sentry/views/performance/metricsSwitch';

import {transformMetricsToArea} from '../../../landing/widgets/transforms/transformMetricsToArea';
import {vitalToMetricsField} from '../../../vitalDetail/utils';

import Content from './content';

const QUERY_KEYS = [
  'environment',
  'project',
  'query',
  'start',
  'end',
  'statsPeriod',
] as const;

type ViewProps = Pick<EventView, typeof QUERY_KEYS[number]>;

type Props = WithRouterProps &
  ViewProps & {
    location: Location;
    organization: OrganizationSummary;
    queryExtra: object;
    withoutZerofill: boolean;
  };

function VitalsChart({
  project,
  environment,
  location,
  organization,
  query,
  statsPeriod,
  router,
  queryExtra,
  withoutZerofill,
  start: propsStart,
  end: propsEnd,
}: Props) {
  const api = useApi();
  const theme = useTheme();
  const {isMetricsData} = useMetricsSwitch();

  const handleLegendSelectChanged = (legendChange: {
    name: string;
    type: string;
    selected: Record<string, boolean>;
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

  const legend = {
    right: 10,
    top: 0,
    selected: getSeriesSelection(location),
    formatter: seriesName => {
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

  const datetimeSelection = {
    start,
    end,
    period: statsPeriod,
  };

  const contentCommonProps = {
    theme,
    router,
    projects: project,
    environments: environment,
    start,
    end,
    period: statsPeriod,
    utc,
    legend,
    queryExtra,
    onLegendSelectChanged: handleLegendSelectChanged,
  };

  const requestCommonProps = {
    api,
    start,
    end,
    statsPeriod,
    project,
    environment,
    query,
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

  if (isMetricsData) {
    const fields = vitals.map(v => `p75(${vitalToMetricsField[v]})`);

    return (
      <Fragment>
        {header}
        <MetricsRequest
          {...requestCommonProps}
          query={new MutableSearch(query).formatString()} // TODO(metrics): not all tags will be compatible with metrics
          orgSlug={organization.slug}
          field={fields}
        >
          {vitalRequestProps => {
            const {errored, loading, reloading} = vitalRequestProps;

            const series = fields.map(field => {
              const {data} = transformMetricsToArea(
                {
                  location,
                  fields: [field],
                  chartSetting: PerformanceWidgetSetting.TPM_AREA,
                },
                vitalRequestProps
              );

              return data[0];
            });

            return (
              <Content
                series={series}
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

  const yAxis = vitals.map(v => `p75(${v})`);

  return (
    <Fragment>
      {header}
      <EventsRequest
        {...requestCommonProps}
        organization={organization}
        period={statsPeriod}
        showLoading={false}
        includePrevious={false}
        yAxis={yAxis}
        partial
        withoutZerofill={withoutZerofill}
        referrer="api.performance.transaction-summary.vitals-chart"
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

export default withRouter(VitalsChart);
