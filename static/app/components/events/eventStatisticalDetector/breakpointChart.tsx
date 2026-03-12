import {LinkButton} from '@sentry/scraps/button';

import {ChartType} from 'sentry/chartcuterie/types';
import TransitionChart from 'sentry/components/charts/transitionChart';
import {TransparentLoadingMask} from 'sentry/components/charts/transparentLoadingMask';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {EventsStatsData} from 'sentry/types/organization';
import {toArray} from 'sentry/utils/array/toArray';
import type {MetaType} from 'sentry/utils/discover/eventView';
import EventView from 'sentry/utils/discover/eventView';
import type {DiscoverQueryProps} from 'sentry/utils/discover/genericDiscoverQuery';
import {useGenericDiscoverQuery} from 'sentry/utils/discover/genericDiscoverQuery';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useRelativeDateTime} from 'sentry/utils/profiling/hooks/useRelativeDateTime';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {Mode} from 'sentry/views/explore/queryParams/mode';
import {getExploreUrl} from 'sentry/views/explore/utils';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';

import type {BreakpointEvidenceData} from './breakpointChartOptions';
import {RELATIVE_DAYS_WINDOW} from './consts';
import {LineChart as Chart} from './lineChart';

type EventBreakpointChartProps = {
  event: Event;
};

export function EventBreakpointChart({event}: EventBreakpointChartProps) {
  const organization = useOrganization();
  const location = useLocation();

  const occurrenceEvidenceData = event?.occurrence?.evidenceData;
  const {transaction, breakpoint} = occurrenceEvidenceData ?? {};

  const eventView = EventView.fromLocation(location);
  eventView.query = `event.type:transaction transaction:"${transaction}"`;
  eventView.dataset = DiscoverDatasets.METRICS;

  const datetime = useRelativeDateTime({
    anchor: breakpoint,
    relativeDays: RELATIVE_DAYS_WINDOW,
  });
  const {start: beforeDateTime, end: afterDateTime} = datetime;

  eventView.start = beforeDateTime.toISOString();
  eventView.end = afterDateTime.toISOString();
  eventView.statsPeriod = undefined;
  const environments = location.query.environment
    ? toArray(location.query.environment)
    : [];
  const parsedProjects = toArray(location.query.project ?? '-1')
    .map(project => Number(project))
    .filter(project => !Number.isNaN(project));
  const projects = parsedProjects.length > 0 ? parsedProjects : [-1];
  const exploreTarget =
    typeof transaction === 'string' && typeof breakpoint === 'number'
      ? getExploreUrl({
          organization,
          mode: Mode.SAMPLES,
          query: `transaction:"${transaction}" is_transaction:True`,
          visualize: [{yAxes: ['p95(span.duration)']}],
          selection: {
            datetime,
            environments,
            projects,
          },
        })
      : undefined;

  const normalizedOccurrenceEvent: BreakpointEvidenceData = {
    aggregate_range_1: occurrenceEvidenceData?.aggregateRange1,
    aggregate_range_2: occurrenceEvidenceData?.aggregateRange2,
    breakpoint: occurrenceEvidenceData?.breakpoint,
  };

  const {data, isPending} = useGenericDiscoverQuery<
    {
      data: EventsStatsData;
      meta: MetaType;
    },
    DiscoverQueryProps
  >({
    route: 'events-stats',
    location,
    eventView,
    orgSlug: organization.slug,
    getRequestPayload: () => ({
      // Manually inject y-axis for events-stats because
      // getEventsAPIPayload doesn't pass it along
      ...eventView.getEventsAPIPayload(location),
      yAxis: ['p95(transaction.duration)', 'count()'],
    }),
  });

  return (
    <InterimSection
      type={SectionKey.REGRESSION_BREAKPOINT_CHART}
      title={t('Regression Breakpoint Chart')}
      actions={
        exploreTarget ? (
          <LinkButton size="xs" to={exploreTarget}>
            {t('Open in Explore')}
          </LinkButton>
        ) : null
      }
    >
      <TransitionChart loading={isPending} reloading>
        <TransparentLoadingMask visible={isPending} />
        <Chart
          // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
          percentileData={data?.['p95(transaction.duration)']?.data ?? []}
          evidenceData={normalizedOccurrenceEvent}
          datetime={datetime}
          chartType={ChartType.SLACK_PERFORMANCE_ENDPOINT_REGRESSION}
        />
      </TransitionChart>
    </InterimSection>
  );
}
