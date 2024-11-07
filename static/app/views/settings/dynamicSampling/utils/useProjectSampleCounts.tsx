import {useMemo} from 'react';

import type {MRI} from 'sentry/types/metrics';
import type {Project} from 'sentry/types/project';
import {
  type MetricsQueryApiQueryParams,
  useMetricsQuery,
} from 'sentry/utils/metrics/useMetricsQuery';
import useProjects from 'sentry/utils/useProjects';

const SPANS_COUNT_METRIC: MRI = `c:spans/count_per_root_project@none`;
const metricsQuery: MetricsQueryApiQueryParams[] = [
  {
    mri: SPANS_COUNT_METRIC,
    aggregation: 'sum',
    name: 'spans',
    groupBy: ['project', 'target_project_id'],
    orderBy: 'desc',
  },
];

export type ProjectionSamplePeriod = '24h' | '30d';

export function useProjectSampleCounts({period}: {period: ProjectionSamplePeriod}) {
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

  const queryResult = data?.data?.[0];

  const projectBySlug = useMemo(
    () =>
      projects.reduce(
        (acc, project) => {
          acc[project.slug] = project;
          return acc;
        },
        {} as Record<string, Project>
      ),
    [projects]
  );

  const projectById = useMemo(
    () =>
      projects.reduce(
        (acc, project) => {
          acc[project.id] = project;
          return acc;
        },
        {} as Record<string, Project>
      ),
    [projects]
  );

  const projectEntries = useMemo(() => {
    const map = new Map<
      string,
      {
        count: number;
        ownCount: number;
        slug: string;
        subProjects: Array<{count: number; slug: string}>;
      }
    >();

    for (const row of queryResult ?? []) {
      const project = row.by.project && projectBySlug[row.by.project];
      const subProject =
        row.by.target_project_id && projectById[row.by.target_project_id];
      const rowValue = row.totals;

      if (!project || !subProject) {
        continue;
      }

      const existingEntry = map.get(project.slug) ?? {
        count: 0,
        ownCount: 0,
        slug: project.slug,
        subProjects: [],
      };

      existingEntry.count += rowValue;

      if (subProject && subProject.id === project.id) {
        existingEntry.ownCount = rowValue;
      } else {
        existingEntry.subProjects.push({
          count: rowValue,
          slug: subProject.slug,
        });
      }

      map.set(project.slug, existingEntry);
    }

    return map;
  }, [projectById, projectBySlug, queryResult]);

  const items = useMemo(
    () =>
      projectEntries
        .entries()
        .map(([key, value]) => {
          return {
            id: key,
            project: projectBySlug[key],
            count: value.count,
            ownCount: value.ownCount,
            // This is a placeholder value to satisfy typing
            // the actual value is calculated in the balanceSampleRate function
            sampleRate: 1,
            subProjects: value.subProjects.toSorted((a, b) => b.count - a.count),
          };
        })
        .toArray(),
    [projectBySlug, projectEntries]
  );

  return {data: items, isPending: fetching || isPending, isError, refetch};
}
