import {
  getDiffInMinutes,
  shouldFetchPreviousPeriod,
} from 'sentry/components/charts/utils';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {DEFAULT_STATS_PERIOD} from 'sentry/constants';
import {t} from 'sentry/locale';
import type {PageFilters} from 'sentry/types/core';
import type {SessionApiResponse} from 'sentry/types/organization';
import {SessionFieldWithOperation} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {getPeriod} from 'sentry/utils/duration/getPeriod';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import {BigNumberWidget} from 'sentry/views/dashboards/widgets/bigNumberWidget/bigNumberWidget';
import {WidgetFrame} from 'sentry/views/dashboards/widgets/common/widgetFrame';
import {
  getSessionTermDescription,
  SessionTerm,
} from 'sentry/views/releases/utils/sessionTerm';

import MissingReleasesButtons from '../missingFeatureButtons/missingReleasesButtons';

type Props = {
  field:
    | SessionFieldWithOperation.CRASH_FREE_RATE_SESSIONS
    | SessionFieldWithOperation.CRASH_FREE_RATE_USERS;
  hasSessions: boolean | null;
  isProjectStabilized: boolean;
  selection: PageFilters;
  project?: Project;
  query?: string;
};

const useCrashFreeRate = (props: Props) => {
  const organization = useOrganization();
  const {selection, isProjectStabilized, hasSessions, query, field} = props;

  const isEnabled = !!(isProjectStabilized && hasSessions);
  const {projects, environments: environment, datetime} = selection;
  const {period} = datetime;

  const doubledPeriod = getPeriod(
    {period, start: undefined, end: undefined},
    {shouldDoublePeriod: true}
  ).statsPeriod;

  const commonQuery = {
    environment,
    project: projects[0],
    interval: getDiffInMinutes(datetime) > 24 * 60 ? '1d' : '1h',
    query,
    field,
  };

  // Unfortunately we can't do something like statsPeriod=28d&interval=14d to get scores for this and previous interval with the single request
  // https://github.com/getsentry/sentry/pull/22770#issuecomment-758595553

  const currentQuery = useApiQuery<SessionApiResponse>(
    [
      `/organizations/${organization.slug}/sessions/`,
      {
        query: {
          ...commonQuery,
          ...normalizeDateTimeParams(datetime),
        },
      },
    ],
    {staleTime: 0, enabled: isEnabled}
  );

  const isPreviousPeriodEnabled = shouldFetchPreviousPeriod({
    start: datetime.start,
    end: datetime.end,
    period: datetime.period,
  });

  const previousQuery = useApiQuery<SessionApiResponse>(
    [
      `/organizations/${organization.slug}/sessions/`,
      {
        query: {
          ...commonQuery,
          statsPeriodStart: doubledPeriod,
          statsPeriodEnd: period ?? DEFAULT_STATS_PERIOD,
        },
      },
    ],
    {
      staleTime: 0,
      enabled: isEnabled && isPreviousPeriodEnabled,
    }
  );

  return {
    crashFreeRate: currentQuery.data,
    previousCrashFreeRate: previousQuery.data,
    isLoading:
      currentQuery.isPending || (previousQuery.isPending && isPreviousPeriodEnabled),
    error: currentQuery.error || previousQuery.error,
    refetch: () => {
      currentQuery.refetch();
      previousQuery.refetch();
    },
  };
};

function ProjectStabilityScoreCard(props: Props) {
  const {hasSessions} = props;
  const organization = useOrganization();

  const cardTitle =
    props.field === SessionFieldWithOperation.CRASH_FREE_RATE_SESSIONS
      ? t('Crash Free Sessions')
      : t('Crash Free Users');

  const cardHelp = getSessionTermDescription(
    props.field === SessionFieldWithOperation.CRASH_FREE_RATE_SESSIONS
      ? SessionTerm.CRASH_FREE_SESSIONS
      : SessionTerm.CRASH_FREE_USERS,
    null
  );

  const {crashFreeRate, previousCrashFreeRate, isLoading, error, refetch} =
    useCrashFreeRate(props);

  const score = !crashFreeRate
    ? undefined
    : crashFreeRate?.groups[0]?.totals[props.field] * 100;

  const previousScore = !previousCrashFreeRate
    ? undefined
    : previousCrashFreeRate?.groups[0]?.totals[props.field] * 100;

  if (hasSessions === false) {
    return (
      <WidgetFrame title={cardTitle} description={cardHelp}>
        <MissingReleasesButtons
          organization={organization}
          health
          platform={props.project?.platform}
        />
      </WidgetFrame>
    );
  }

  return (
    <BigNumberWidget
      title={cardTitle}
      description={cardHelp}
      data={[
        {
          [`${props.field}()`]: score ? score / 100 : undefined,
        },
      ]}
      previousPeriodData={[
        {
          [`${props.field}()`]: previousScore ? previousScore / 100 : undefined,
        },
      ]}
      meta={{
        fields: {
          [`${props.field}()`]: 'percentage',
        },
      }}
      preferredPolarity="+"
      isLoading={isLoading}
      error={error ?? undefined}
      onRetry={refetch}
    />
  );
}

export default ProjectStabilityScoreCard;
