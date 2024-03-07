import {useCallback, useMemo} from 'react';

import type {Project, ProjectVisibility} from 'sentry/types';
import useFetchSequentialPages from 'sentry/utils/api/useFetchSequentialPages';
import projectToProjectVisibility from 'sentry/utils/project/projectToProjectVisibility';
import type {ApiQueryKey} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

interface Props {
  enabled?: boolean;
  initialCursor?: string;
  perPage?: number;
}

export default function useAllProjectsVisibility({
  enabled,
  initialCursor,
  perPage,
}: Props) {
  const organiation = useOrganization();
  const {pages, isFetching, getLastResponseHeader, isError, error} =
    useFetchSequentialPages<Project[]>({
      enabled: enabled ?? true,
      initialCursor: initialCursor ?? '0:0:0',

      getQueryKey: useCallback(
        ({cursor, per_page}): ApiQueryKey => [
          `/organizations/${organiation.slug}/projects/`,
          {
            query: {
              per_page,
              cursor,
            },
          },
        ],
        [organiation.slug]
      ),
      perPage: perPage ?? 100,
    });

  const projects = useMemo(
    () =>
      pages.flatMap((items): ProjectVisibility[] =>
        items.map(projectToProjectVisibility)
      ),
    [pages]
  );

  const getBySlug = useCallback(
    (slug: string | undefined): ProjectVisibility | undefined =>
      slug
        ? Object.fromEntries(projects.map(project => [project.slug, project]))[slug]
        : undefined,
    [projects]
  );
  const getById = useCallback(
    (id: string | undefined): ProjectVisibility | undefined =>
      id
        ? Object.fromEntries(projects.map(project => [project.id, project]))[id]
        : undefined,
    [projects]
  );

  return {
    projects,
    getBySlug,
    getById,
    isFetching,
    getLastResponseHeader,
    isError,
    error,
  };
}
