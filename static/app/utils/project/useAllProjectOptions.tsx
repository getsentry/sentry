import {useCallback, useMemo} from 'react';

import type {Project, ProjectOption} from 'sentry/types';
import useFetchSequentialPages from 'sentry/utils/api/useFetchSequentialPages';
import type {ApiQueryKey} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

interface Props {
  enabled?: boolean;
  initialCursor?: string;
  perPage?: number;
}

/**
 * Temporary converter until https://github.com/getsentry/sentry/pull/66290 lands
 * and we can fetch only the data we need directly.
 *
 * @deprecated
 */
function projectToProjectOption({
  id,
  slug,
  isMember,
  environments,
  platform,
}: Project): ProjectOption {
  return {
    id,
    slug,
    isMember,
    environments,
    platform: platform || 'other', // Use `||` to account for `null` or `""`
  };
}

export default function useAllProjectsOptions({enabled, initialCursor, perPage}: Props) {
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
    () => pages.flatMap((items): ProjectOption[] => items.map(projectToProjectOption)),
    [pages]
  );

  const getBySlug = useCallback(
    (slug: string | undefined): ProjectOption | undefined =>
      slug ? projects.find(project => project.slug === slug) : undefined,
    [projects]
  );
  const getById = useCallback(
    (id: string | undefined): ProjectOption | undefined =>
      id ? projects.find(project => project.id === id) : undefined,
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
