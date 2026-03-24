import {useCallback} from 'react';

import {makeCommandPaletteLink} from 'sentry/components/commandPalette/makeCommandPaletteAction';
import type {CommandPaletteAction} from 'sentry/components/commandPalette/types';
import {useDynamicCommandPaletteAction} from 'sentry/components/commandPalette/useDynamicCommandPaletteAction';
import {
  DSN_PATTERN,
  getDsnNavTargets,
} from 'sentry/components/search/sources/dsnLookupUtils';
import type {DsnLookupResponse} from 'sentry/components/search/sources/dsnLookupUtils';
import {IconIssues, IconList, IconSettings} from 'sentry/icons';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {useApi} from 'sentry/utils/useApi';
import {useOrganization} from 'sentry/utils/useOrganization';

const ICONS: React.ReactElement[] = [
  <IconIssues key="issues" />,
  <IconSettings key="settings" />,
  <IconList key="list" />,
];

export function useDsnLookupActions(): void {
  const api = useApi();
  const organization = useOrganization({allowNull: true});
  const hasDsnLookup = organization?.features?.includes('cmd-k-dsn-lookup') ?? false;

  const queryAction = useCallback(
    async (query: string): Promise<CommandPaletteAction[]> => {
      if (!DSN_PATTERN.test(query) || !organization || !hasDsnLookup) {
        return [];
      }

      const url = getApiUrl('/organizations/$organizationIdOrSlug/dsn-lookup/', {
        path: {organizationIdOrSlug: organization.slug},
      });

      const data = await api.requestPromise(url, {query: {dsn: query}});

      return getDsnNavTargets(data as DsnLookupResponse).map((target, i) =>
        makeCommandPaletteLink({
          display: {
            label: target.label,
            details: target.description,
            icon: ICONS[i],
          },
          groupingKey: 'search-result',
          to: target.to,
        })
      );
    },
    [api, organization, hasDsnLookup]
  );

  useDynamicCommandPaletteAction(queryAction);
}
