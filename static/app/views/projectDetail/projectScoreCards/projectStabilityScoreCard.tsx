import round from 'lodash/round';

import {
  getDiffInMinutes,
  shouldFetchPreviousPeriod,
} from 'sentry/components/charts/utils';
import LoadingError from 'sentry/components/loadingError';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import ScoreCard from 'sentry/components/scoreCard';
import {DEFAULT_STATS_PERIOD} from 'sentry/constants';
import {IconArrow} from 'sentry/icons';
import {t} from 'sentry/locale';
import {PageFilters, SessionApiResponse, SessionFieldWithOperation} from 'sentry/types';
import {defined} from 'sentry/utils';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import {getPeriod} from 'sentry/utils/getPeriod';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import {displayCrashFreePercent} from 'sentry/views/releases/utils';
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
      enabled:
        isEnabled &&
        shouldFetchPreviousPeriod({
          start: datetime.start,
          end: datetime.end,
          period: datetime.period,
        }),
    }
  );

  return {
    crashFreeRate: currentQuery.data,
    previousCrashFreeRate: previousQuery.data,
    isLoading: currentQuery.isLoading || previousQuery.isLoading,
    error: currentQuery.error || previousQuery.error,
    refetch: () => {
      currentQuery.refetch();
      previousQuery.refetch();
    },
  };
};

// shouldRenderBadRequests = true;

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

  const trend =
    defined(score) && defined(previousScore)
      ? round(score - previousScore, 3)
      : undefined;

  const shouldRenderTrend = !isLoading && defined(score) && defined(trend);

  if (hasSessions === false) {
    return (
      <ScoreCard
        title={cardTitle}
        help={cardHelp}
        score={<MissingReleasesButtons organization={organization} health />}
      />
    );
  }

  if (error) {
    return (
      <LoadingError
        message={error.responseJSON?.detail || t('There was an error loading data.')}
        onRetry={refetch}
      />
    );
  }

  return (
    <ScoreCard
      title={cardTitle}
      help={cardHelp}
      score={isLoading || !defined(score) ? '\u2014' : displayCrashFreePercent(score)}
      trend={
        shouldRenderTrend ? (
          <div>
            {trend >= 0 ? (
              <IconArrow direction="up" size="xs" />
            ) : (
              <IconArrow direction="down" size="xs" />
            )}
            {`${formatAbbreviatedNumber(Math.abs(trend))}\u0025`}
          </div>
        ) : null
      }
      trendStatus={!trend ? undefined : trend > 0 ? 'good' : 'bad'}
    />
  );
}

export default ProjectStabilityScoreCard;
