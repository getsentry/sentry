import {useCallback, useEffect, useMemo, useState} from 'react';

import {
  createDocIntegrationResults,
  createIntegrationResults,
  createMemberResults,
  createPluginResults,
  createProjectResults,
  createSentryAppResults,
  createTeamResults,
  queryResults,
} from 'sentry/components/search/sources/apiSource';
import type {ResultItem} from 'sentry/components/search/sources/types';
import {IconDocs} from 'sentry/icons';
import {t} from 'sentry/locale';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

import type {OmniAction} from './types';

function createOmniAction(result: ResultItem, index: number): OmniAction {
  return {
    key: `api-${result.resultType}-${index}`,
    areaKey: 'global',
    label: result.title as string,
    details: (result.description || result.model?.description) ?? '',
    section: t('Documentation'),
    actionIcon: <IconDocs />,
    onAction: () => {
      if (typeof result.to === 'string') {
        window.open(result.to, '_blank', 'noreferrer');
      }
    },
  };
}

/**
 * Hook that fetches API results and converts them to dynamic actions
 * for the OmniSearch palette.
 *
 * @param query - The search query string (should be debounced)
 * @returns Array of dynamic actions based on API results
 */
export function useApiDynamicActions(query: string): OmniAction[] {
  const api = useApi();
  const organization = useOrganization({allowNull: true});
  const [results, setResults] = useState<ResultItem[]>([]);

  const handleSearch = useCallback(async () => {
    const pendingResults: Array<Promise<ResultItem[] | null>> = [];

    if (organization) {
      const org = organization;
      const slug = organization.slug;

      const q = (url: string) => queryResults(api, url, query);

      const searchQueries = [
        createProjectResults(q(`/organizations/${slug}/projects/`), org),
        createTeamResults(q(`/organizations/${slug}/teams/`), org),
        createMemberResults(q(`/organizations/${slug}/members/`), org),
        createPluginResults(q(`/organizations/${slug}/plugins/configs/`), org),
        createIntegrationResults(q(`/organizations/${slug}/config/integrations/`), org),
        createSentryAppResults(q('/sentry-apps/?status=published'), org),
        createDocIntegrationResults(q('/doc-integrations/'), org),
      ];
      pendingResults.push(...searchQueries);
    }

    const resolvedResults = await Promise.all(pendingResults);
    setResults(resolvedResults.flat().filter(i => i !== null));
  }, [api, query, organization]);

  useEffect(() => {
    void handleSearch();
  }, [handleSearch]);

  const dynamicActions = useMemo(() => {
    const actions: OmniAction[] = [];
    if (query) {
      results.forEach((result, index) => {
        actions.push(createOmniAction(result, index));
      });
    }

    return actions;
  }, [query, results]);

  return dynamicActions;
}
