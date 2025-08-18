import {useCallback, useEffect, useMemo, useState} from 'react';

import {makeResolvedTs} from 'sentry/components/search/sources/utils';
import {IconBusiness} from 'sentry/icons';
import {t} from 'sentry/locale';
import OrganizationsStore from 'sentry/stores/organizationsStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import type {Organization} from 'sentry/types/organization';
import type {Fuse} from 'sentry/utils/fuzzySearch';
import {createFuzzySearch} from 'sentry/utils/fuzzySearch';

import type {OmniAction} from './types';

type OrganizationItem = {
  description: string;
  model: Organization;
  resolvedTs: number;
  resultType: string;
  slug: string;
  sourceType: string;
  title: string;
  to: string;
};

/**
 * Hook that fetches organization results and converts them to dynamic actions
 * for the OmniSearch palette.
 *
 * @param query - The search query string (should be debounced)
 * @returns Array of dynamic actions based on organizations
 */
export function useOrganizationsDynamicActions(query: string): OmniAction[] {
  const {organizations} = useLegacyStore(OrganizationsStore);
  const [fuzzy, setFuzzy] = useState<Fuse<OrganizationItem> | null>(null);

  const createSearch = useCallback(async () => {
    if (organizations.length === 0) {
      return;
    }

    const resolvedTs = makeResolvedTs();
    const orgItems = organizations.map(
      org =>
        ({
          title: org.name,
          description: t('Switch to the %s organization', org.slug),
          to: `/${org.slug}/`,
          model: org,
          slug: org.slug,
          sourceType: 'organization',
          resultType: 'route',
          resolvedTs,
        }) as OrganizationItem
    );

    const search = await createFuzzySearch<OrganizationItem>(orgItems, {
      keys: ['title', 'description', 'slug'],
    });

    setFuzzy(search);
  }, [organizations]);

  useEffect(() => {
    void createSearch();
  }, [createSearch]);

  const dynamicActions = useMemo(() => {
    if (!query || !fuzzy) {
      return [];
    }

    const results = fuzzy.search(query);

    return results.map((result, index) => {
      const item = result.item;
      return {
        key: `org-${index}`,
        areaKey: 'navigate',
        label: item.title,
        details: item.description,
        section: 'Organizations',
        actionIcon: <IconBusiness />,
        to: item.to,
      } as OmniAction;
    });
  }, [query, fuzzy]);

  return dynamicActions;
}
