import {useCallback, type ReactNode} from 'react';

import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {t} from 'sentry/locale';
import type {PageFilters} from 'sentry/types/core';
import {useValidateTraceItemAttributes} from 'sentry/views/explore/hooks/useValidateTraceItemAttributes';
import type {TraceItemDataset} from 'sentry/views/explore/types';

/**
 * Adapter hook that wraps `useValidateTraceItemAttributes` into the generic
 * `validateFilterKeys` signature expected by SearchQueryBuilder.
 */
export function useAsyncAttributeValidation(
  itemType: TraceItemDataset,
  projects?: PageFilters['projects']
) {
  const {mutateAsync} = useValidateTraceItemAttributes();
  const {selection} = usePageFilters();

  const effectiveProjects = projects ?? selection.projects;

  return useCallback(
    async (keys: string[]): Promise<Record<string, ReactNode>> => {
      const response = await mutateAsync({
        itemType,
        attributes: keys,
        query: {
          ...Object.fromEntries(
            Object.entries(normalizeDateTimeParams(selection.datetime)).filter(
              (entry): entry is [string, string | string[]] => entry[1] !== null
            )
          ),
          ...(effectiveProjects?.length ? {project: effectiveProjects.map(String)} : {}),
        },
      });
      const warnings: Record<string, ReactNode> = {};
      for (const [key, result] of Object.entries(response.attributes)) {
        if (!result.valid) {
          warnings[key] = t('Invalid key. "%s" is not a supported search key.', key);
        }
      }
      return warnings;
    },
    [itemType, mutateAsync, effectiveProjects, selection.datetime]
  );
}
