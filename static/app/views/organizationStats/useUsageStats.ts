import {useMemo} from 'react';

import type {DateTimeObject} from 'sentry/components/charts/utils';
import {getSeriesApiInterval} from 'sentry/components/charts/utils';
import {DEFAULT_STATS_PERIOD} from 'sentry/constants';
import {ALL_ACCESS_PROJECTS} from 'sentry/constants/pageFilters';
import {DataCategoryExact} from 'sentry/types/core';
import {hasDynamicSamplingCustomFeature} from 'sentry/utils/dynamicSampling/features';
import {type ApiQueryKey} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

interface Props {
  dataCategoryName: DataCategoryExact;
  dataDatetime: DateTimeObject;
  isSingleProject: boolean;
  projectIds: number[];
}

export default function useUsageStatsQueryKey({
  dataCategoryName,
  dataDatetime,
  isSingleProject,
  projectIds,
}: Props) {
  const organization = useOrganization();

  const endpointQuery = useMemo(() => {
    const queryDatetime =
      dataDatetime.start && dataDatetime.end
        ? {
            start: dataDatetime.start,
            end: dataDatetime.end,
            utc: dataDatetime.utc,
          }
        : {
            statsPeriod: dataDatetime.period || DEFAULT_STATS_PERIOD,
          };

    const groupBy = ['outcome', 'project'];
    const category: string[] = [dataCategoryName];

    if (
      hasDynamicSamplingCustomFeature(organization) &&
      dataCategoryName === DataCategoryExact.SPAN
    ) {
      groupBy.push('category');
      category.push(DataCategoryExact.SPAN_INDEXED);
    }
    if (
      dataCategoryName === DataCategoryExact.PROFILE_DURATION ||
      dataCategoryName === DataCategoryExact.PROFILE_DURATION_UI
    ) {
      groupBy.push('category');
      category.push(
        dataCategoryName === DataCategoryExact.PROFILE_DURATION
          ? DataCategoryExact.PROFILE_CHUNK
          : DataCategoryExact.PROFILE_CHUNK_UI
      );
    }

    // We do not need more granularity in the data so interval is '1d'
    return {
      ...queryDatetime,
      interval: getSeriesApiInterval(dataDatetime),
      groupBy,
      field: ['sum(quantity)'],
      // If only one project is in selected, display the entire project list
      project: isSingleProject ? [ALL_ACCESS_PROJECTS] : projectIds,
      category,
    };
  }, [organization, dataDatetime, dataCategoryName, isSingleProject, projectIds]);

  return [
    `/organizations/${organization.slug}/stats_v2/`,
    {
      // We do not need more granularity in the data so interval is '1d'
      query: endpointQuery,
    },
  ] as ApiQueryKey;
}
