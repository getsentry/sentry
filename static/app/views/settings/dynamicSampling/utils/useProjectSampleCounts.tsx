import {useMemo} from 'react';

import type {MetricsQueryApiResponse} from 'sentry/types/metrics';
import type {Project} from 'sentry/types/project';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';

export interface ProjectSampleCount {
  count: number;
  ownCount: number;
  project: Project;
  subProjects: Array<{count: number; slug: string}>;
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
        .map<ProjectSampleCount>(([key, value]) => {
          return {
            project: projectBySlug[key],
            count: value.count,
            ownCount: value.ownCount,
            subProjects: value.subProjects.toSorted((a, b) => b.count - a.count),
          };
        })
        .toArray(),
    [projectBySlug, projectEntries]
  );

  return {data: items, isPending: fetching || isPending, isError, refetch};
}
