import {useEffect, useMemo} from 'react';
import * as Sentry from '@sentry/react';

import type {RepositoryProjectPathConfig} from 'sentry/types/integrations';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

interface UseCodeMappingsParams {
  enabled: boolean;
}

const FIFTEEN_MINUTES = 15 * 60 * 1000;

export function useCodeMappings({enabled}: UseCodeMappingsParams) {
  const organization = useOrganization();
  const {
    data: codeMappings,
    isLoading,
    isPending,
    isError,
  } = useApiQuery<RepositoryProjectPathConfig[]>(
    [`/organizations/${organization.slug}/code-mappings/`],
    {
      // Code mappings are not updated frequently, so we can cache them for a longer time.
      staleTime: FIFTEEN_MINUTES,
      enabled,
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
      if (!existingProjects.has(mapping.projectId)) {
        existingProjects.add(mapping.projectId);
        map.set(mapping.repoId, existingProjects);
      }
    });

    return map;
  }, [codeMappings]);

  useEffect(() => {
    if (isError) {
      Sentry.captureException(new Error('Error fetching repository project mapping'));
    }
  }, [isError]);

  return {
    codeMappings,
    codeMappingsMap,
    isLoading,
    isPending,
    isError,
  };
}
