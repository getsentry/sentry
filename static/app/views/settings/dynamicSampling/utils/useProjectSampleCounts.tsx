import {useMemo} from 'react';

import type {Project} from 'sentry/types/project';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {mapArrayToObject} from 'sentry/views/settings/dynamicSampling/utils';

interface MetricsQueryApiResponse {
  data: Array<
    Array<{
      by: Record<string, string>;
      series: Array<number | null>;
      totals: number;
    }>
  >;
  end: string;
  intervals: string[];
  start: string;
}

export interface ProjectSampleCount {
  count: number;
  ownCount: number;
  project: Project;
  subProjects: Array<{count: number; project: Project}>;
}

export type ProjectionSamplePeriod = '24h' | '30d';

export function useProjectSampleCounts({period}: {period: ProjectionSamplePeriod}) {
  const organization = useOrganization();
  const {projects, fetching} = useProjects();

  const {data, isPending, isError, refetch} = useApiQuery<MetricsQueryApiResponse>(
    [
      `/organizations/${organization.slug}/sampling/project-root-counts/`,
      {
        query: {
          statsPeriod: period,
        },
      },
    ],
    {
      staleTime: 0,
    }
  );

  const queryResult = data?.data?.[0];

  const projectBySlug = useMemo(
    () =>
      mapArrayToObject({
        array: projects,
        keySelector: project => project.slug,
        valueSelector: project => project,
      }),
    [projects]
  );

  const projectById = useMemo(
    () =>
      mapArrayToObject({
        array: projects,
        keySelector: project => project.id,
        valueSelector: project => project,
      }),
    [projects]
  );

  const items = useMemo(() => {
    const map = new Map<string, ProjectSampleCount>();

    for (const row of queryResult ?? []) {
      const project = row.by.project && projectBySlug[row.by.project];
      const subProject =
        row.by.target_project_id && projectById[row.by.target_project_id];
      const rowValue = row.totals;

      if (!project || !subProject) {
        continue;
      }

      // Initialize the map with the project slug if needed
      if (!map.has(project.slug)) {
        map.set(project.slug, {
          project,
          count: 0,
          ownCount: 0,
          subProjects: [],
        });
      }

      const entry = map.get(project.slug)!;
      // Increment the total count for the project
      entry.count += rowValue;

      // Depending on if the value is from the project or a subproject, we need to set the ownCount
      // or add the subproject to the subProjects array
      if (subProject.id === project.id) {
        entry.ownCount = rowValue;
      } else {
        entry.subProjects.push({
          count: rowValue,
          project: subProject,
        });
      }
    }

    // Sort the subprojects by count
    return Array.from(map.values()).map<ProjectSampleCount>(value => {
      return {
        ...value,
        subProjects: value.subProjects.toSorted((a: any, b: any) => b.count - a.count),
      };
    });
  }, [projectById, projectBySlug, queryResult]);

  return {data: items, isPending: fetching || isPending, isError, refetch};
}
