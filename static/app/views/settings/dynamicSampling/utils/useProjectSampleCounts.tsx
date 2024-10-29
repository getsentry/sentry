import {useMemo} from 'react';

import type {MRI} from 'sentry/types/metrics';
import {
  type MetricsQueryApiQueryParams,
  useMetricsQuery,
} from 'sentry/utils/metrics/useMetricsQuery';
import useProjects from 'sentry/utils/useProjects';

// TODO(aknaus): Switch to c:spans/count_per_root_project@none once available
const SPANS_COUNT_METRIC: MRI = `c:transactions/count_per_root_project@none`;
const metricsQuery: MetricsQueryApiQueryParams[] = [
  {
    mri: SPANS_COUNT_METRIC,
    aggregation: 'count',
    name: 'spans',
    groupBy: ['project'],
    orderBy: 'desc',
  },
];

const fakeSubProjects = ['angular', 'sentry', 'snuba', 'relay', 'email-service'];

export function useProjectSampleCounts({period}: {period: '24h' | '30d'}) {
  const {projects, fetching} = useProjects();

  const {data, isPending, isError, refetch} = useMetricsQuery(
    metricsQuery,
    {
      datetime: {
        start: null,
        end: null,
        utc: true,
        period,
      },
      environments: [],
      projects: [],
    },
    {
      includeSeries: false,
      interval: period === '24h' ? '1h' : '1d',
    }
  );

  const projectBySlug = useMemo(
    () =>
      projects.reduce((acc, project) => {
        acc[project.slug] = project;
        return acc;
      }, {}),
    [projects]
  );

  const groupedCounts = useMemo(
    () =>
      (data?.data[0] ?? [])
        .map(item => {
          // TODO(aknaus): Remove mock data once real data is available
          // Create random sub-projects for testing UI
          const hasSubProjects = Math.random() > 0.3;
          const countMagnitude = Math.floor(Math.log10(item.totals));
          const subProjects = hasSubProjects
            ? fakeSubProjects.map(slug => ({
                slug: slug,
                count: Math.floor(Math.random() * Math.pow(10, countMagnitude + 1)),
              }))
            : [];

          const total =
            item.totals +
            subProjects.reduce((acc, subProject) => acc + subProject.count, 0);

          return {
            id: item.by.project,
            project: projectBySlug[item.by.project],
            count: total,
            ownCount: item.totals,
            // This is a placeholder value to satisfy typing
            // the actual value is calculated in the balanceSampleRate function
            sampleRate: 1,
            subProjects: subProjects.toSorted((a, b) => b.count - a.count),
          };
        })
        // Remove items where we cannot match the project
        .filter(item => item.project),
    [data?.data, projectBySlug]
  );

  return {data: groupedCounts, isPending: fetching || isPending, isError, refetch};
}
