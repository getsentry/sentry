import {useMemo, useRef, useState} from 'react';
import * as Sentry from '@sentry/react';

import type {Repository, RepositoryProjectPathConfig} from 'sentry/types/integrations';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

interface UseRepositoryProjectMappingParams {
  repositories: Repository[];
}

const FIFTEEN_MINUTES = 900_000;

export function useRepositoryProjectMapping({
  repositories,
}: UseRepositoryProjectMappingParams) {
  const [repositoryProjectMapping, setRepositoryProjectMapping] = useState<
    Record<string, string[]>
  >({});
  const hasInitialized = useRef(false);
  const organization = useOrganization();
  const {
    data: codeMappings,
    isPending,
    isError,
  } = useApiQuery<RepositoryProjectPathConfig[]>(
    [`/organizations/${organization.slug}/code-mappings/`],
    {
      // Code mappings are not updated frequently, so we can cache them for a longer time.
      staleTime: FIFTEEN_MINUTES,
      enabled: repositories.length > 0,
    }
  );

  // Create a map of repository ID to project slugs based on code mappings.
  // This is only used to pre-populate the repository -> project mappings.
  const codeMappingsMap = useMemo(() => {
    if (!codeMappings) {
      return new Map<string, Set<string>>();
    }

    const map = new Map<string, Set<string>>();
    codeMappings.forEach(mapping => {
      const existingProjects = map.get(mapping.repoId) || new Set<string>();
      if (!existingProjects.has(mapping.projectSlug)) {
        existingProjects.add(mapping.projectSlug);
        map.set(mapping.repoId, existingProjects);
      }
    });

    return map;
  }, [codeMappings]);

  // Initialize mappings from code mappings when they're available and
  // only when there are no repository -> project mappings yet
  if (!isPending && codeMappings && !hasInitialized.current) {
    const initialMappings: Record<string, string[]> = {};
    repositories.forEach(repo => {
      const mappedProjects = Array.from(codeMappingsMap.get(repo.id) || []);
      initialMappings[repo.id] = mappedProjects;
    });
    setRepositoryProjectMapping(initialMappings);
    hasInitialized.current = true;
  }

  if (isError) {
    Sentry.captureException(new Error('Error fetching repository project mapping'));
  }

  return {
    repositoryProjectMapping,
    setRepositoryProjectMapping,
    isPending,
    isError,
  };
}
