import {Fragment} from 'react';
// eslint-disable-next-line no-restricted-imports
import {withRouter, WithRouterProps} from 'react-router';
import {Location, Query} from 'history';

import EventsRequest from 'sentry/components/charts/eventsRequest';
import {HeaderTitleLegend} from 'sentry/components/charts/styles';
import {getInterval} from 'sentry/components/charts/utils';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {t} from 'sentry/locale';
import {Organization, OrganizationSummary} from 'sentry/types';
import {Series} from 'sentry/types/echarts';
import {getUtcToLocalDateObject} from 'sentry/utils/dates';
import {useMEPSettingContext} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import useApi from 'sentry/utils/useApi';
import {getTermHelp, PERFORMANCE_TERM} from 'sentry/views/performance/data';
import {getMEPQueryParams} from 'sentry/views/performance/landing/widgets/utils';
import {DurationChart} from 'sentry/views/performance/landing/widgets/widgets/singleFieldAreaWidget';
import {ViewProps} from 'sentry/views/performance/types';

type Props = WithRouterProps &
  ViewProps & {
    location: Location;
    organization: OrganizationSummary;
    queryExtra: Query;
    withoutZerofill: boolean;
  };

/**
 * Fetch and render an area chart that shows user misery over a period
 */
function UserMiseryChart({
  project,
  environment,
  location,
  organization,
  query,
  statsPeriod,
  withoutZerofill,
  start: propsStart,
  end: propsEnd,
}: Props) {
  const api = useApi();
  const mepContext = useMEPSettingContext();

  const start = propsStart ? getUtcToLocalDateObject(propsStart) : null;
  const end = propsEnd ? getUtcToLocalDateObject(propsEnd) : null;
  const utc = normalizeDateTimeParams(location.query).utc === 'true';
  const period = statsPeriod;

  const datetimeSelection = {start, end, period};

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
      {t('User Misery')}
      <QuestionTooltip
        size="sm"
        position="top"
        title={getTermHelp(organization as Organization, PERFORMANCE_TERM.USER_MISERY)}
      />
    </HeaderTitleLegend>
  );

  const yAxis = 'user_misery()';

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
        referrer="api.performance.transaction-summary.user-misery-chart"
        queryExtras={getMEPQueryParams(mepContext)}
      >
        {({loading, reloading, timeseriesData}) => {
          const data: Series[] = timeseriesData?.[0]
            ? [{...timeseriesData[0], seriesName: yAxis}]
            : [];
          return (
            <DurationChart
              grid={{left: '10px', right: '10px', top: '40px', bottom: '0px'}}
              data={data}
              statsPeriod={statsPeriod}
              loading={loading || reloading}
              disableMultiAxis
              definedAxisTicks={4}
              start={start}
              end={end}
              utc={utc}
            />
          );
        }}
      </EventsRequest>
    </Fragment>
  );
}

export default withRouter(UserMiseryChart);
