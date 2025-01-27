import styled from '@emotion/styled';

import {t} from 'sentry/locale';
import type {DataCategoryInfo} from 'sentry/types/core';
import {Outcome} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {useApiQuery} from 'sentry/utils/queryClient';

import type {UsageSeries} from './types';
import {formatUsageWithUnits, getFormatUsageOptions} from './utils';

type Props = {
  dataCategory: DataCategoryInfo['plural'];
  dataCategoryApiName: DataCategoryInfo['apiName'];
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
function UsageStatsPerMin({
  organization,
  projectIds,
  dataCategory,
  dataCategoryApiName,
}: Props) {
  const {
    data: orgStats,
    isPending,
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

  if (isPending || isError || !orgStats || orgStats.intervals.length === 0) {
    return null;
  }

  const minuteData = (): string | undefined => {
    // The last minute in the series is still "in progress"
    // Read data from 2nd last element for the latest complete minute
    const {intervals, groups} = orgStats;
    const lastMin = Math.max(intervals.length - 2, 0);

    const eventsLastMin = groups.reduce((count, group) => {
      const {category, outcome} = group.by;

      if (dataCategoryApiName === 'span_indexed') {
        if (category !== 'span_indexed' || outcome !== Outcome.ACCEPTED) {
          return count;
        }
      } else {
        // HACK: The backend enum are singular, but the frontend enums are plural
        if (!dataCategory.includes(`${category}`) || outcome !== Outcome.ACCEPTED) {
          return count;
        }
      }

      count += group.series['sum(quantity)']![lastMin]!;
      return count;
    }, 0);

    return formatUsageWithUnits(
      eventsLastMin,
      dataCategory,
      getFormatUsageOptions(dataCategory)
    );
  };

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
