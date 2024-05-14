import styled from '@emotion/styled';

import {DATA_CATEGORY_INFO} from 'sentry/constants';
import {t} from 'sentry/locale';
import type {DataCategoryInfo, Organization} from 'sentry/types';
import {Outcome} from 'sentry/types';
import {useApiQuery} from 'sentry/utils/queryClient';

import type {UsageSeries} from './types';
import {formatUsageWithUnits, getFormatUsageOptions} from './utils';

type Props = {
  dataCategory: DataCategoryInfo['plural'];
  organization: Organization;
  projectIds: number[];
};

/**
 * Making 1 extra API call to display this number isn't very efficient.
 * The other approach would be to fetch the data in UsageStatsOrg with 1min
 * interval and roll it up on the frontend, but that (1) adds unnecessary
 * complexity as it's gnarly to fetch + rollup 90 days of 1min intervals,
 * (3) API resultset has a limit of 1000, so 90 days of 1min would not work.
 *
 * We're going with this approach for simplicity sake. By keeping the range
 * as small as possible, this call is quite fast.
 */
function UsageStatsPerMin({dataCategory, organization, projectIds}: Props) {
  const {
    data: orgStats,
    isLoading,
    isError,
  } = useApiQuery<UsageSeries>(
    [
      `/organizations/${organization.slug}/stats_v2/`,
      {
        query: {
          statsPeriod: '5m', // Any value <1h will return current hour's data
          interval: '1m',
          groupBy: ['category', 'outcome'],
          project: projectIds,
          field: ['sum(quantity)'],
        },
      },
    ],
    {
      staleTime: 0,
    }
  );

  if (isLoading || isError || !orgStats || orgStats.intervals.length === 0) {
    return null;
  }

  const minuteData = (): string | undefined => {
    // The last minute in the series is still "in progress"
    // Read data from 2nd last element for the latest complete minute
    const {intervals, groups} = orgStats;
    const lastMin = Math.max(intervals.length - 2, 0);

    const eventsLastMin = groups.reduce((count, group) => {
      const {outcome, category} = group.by;

      // HACK: The backend enum are singular, but the frontend enums are plural
      if (!dataCategory.includes(`${category}`) || outcome !== Outcome.ACCEPTED) {
        return count;
      }

      count += group.series['sum(quantity)'][lastMin];
      return count;
    }, 0);

    return formatUsageWithUnits(
      eventsLastMin,
      dataCategory,
      getFormatUsageOptions(dataCategory)
    );
  };

  // Metrics stats ingestion is delayed, so we can't show this for metrics right now
  if (dataCategory === DATA_CATEGORY_INFO.metrics.plural) {
    return null;
  }

  return (
    <Wrapper>
      {minuteData()} {t('in last min')}
    </Wrapper>
  );
}

export default UsageStatsPerMin;

const Wrapper = styled('div')`
  display: inline-block;
  color: ${p => p.theme.success};
  font-size: ${p => p.theme.fontSizeMedium};
`;
