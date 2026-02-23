import {useMemo} from 'react';

import type {CommandPaletteAction} from 'sentry/components/commandPalette/types';
import {useCommandPaletteActions} from 'sentry/components/commandPalette/useCommandPaletteActions';
import {
  DSN_PATTERN,
  getDsnNavTargets,
} from 'sentry/components/search/sources/dsnLookupUtils';
import type {DsnLookupResponse} from 'sentry/components/search/sources/dsnLookupUtils';
import {IconIssues, IconList, IconSettings} from 'sentry/icons';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

const ICONS: React.ReactElement[] = [
  <IconIssues key="issues" />,
  <IconSettings key="settings" />,
  <IconList key="list" />,
];

export function useDsnLookupActions(query: string): void {
  const organization = useOrganization({allowNull: true});
  const hasDsnLookup = organization?.features?.includes('cmd-k-dsn-lookup') ?? false;
  const isDsn = DSN_PATTERN.test(query);

  const {data} = useApiQuery<DsnLookupResponse>(
    [
      getApiUrl('/organizations/$organizationIdOrSlug/dsn-lookup/', {
        path: {organizationIdOrSlug: organization?.slug ?? ''},
      }),
      {query: {dsn: query}},
    ],
    {
      staleTime: 30_000,
      enabled: isDsn && !!organization && hasDsnLookup,
    }
  );

  const actions: CommandPaletteAction[] = useMemo(() => {
    if (!isDsn || !data) {
      return [];
    }

    return getDsnNavTargets(data).map((target, i) => ({
      type: 'navigate' as const,
      to: target.to,
      display: {
        label: target.label,
        details: target.description,
        icon: ICONS[i],
      },
      groupingKey: 'search-result' as const,
    }));
  }, [isDsn, data]);

  useCommandPaletteActions(actions);
}
