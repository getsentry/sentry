import {useMemo} from 'react';

import type {CommandPaletteActionWithKey} from 'sentry/components/commandPalette/types';
import {
  DSN_PATTERN,
  getDsnNavTargets,
} from 'sentry/components/search/sources/dsnLookupUtils';
import type {DsnLookupResponse} from 'sentry/components/search/sources/dsnLookupUtils';
import {IconIssues, IconList, IconSettings} from 'sentry/icons';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';
import useOrganization from 'sentry/utils/useOrganization';

const ICON_MAP: Record<string, React.ReactElement> = {
  'dsn-lookup-issues': <IconIssues />,
  'dsn-lookup-project-settings': <IconSettings />,
  'dsn-lookup-client-keys': <IconList />,
};

export function useDsnLookupActions(query: string): CommandPaletteActionWithKey[] {
  const organization = useOrganization({allowNull: true});
  const debouncedQuery = useDebouncedValue(query, 300);
  const isDsn = DSN_PATTERN.test(debouncedQuery);

  const {data} = useApiQuery<DsnLookupResponse>(
    [
      getApiUrl('/organizations/$organizationIdOrSlug/dsn-lookup/', {
        path: {organizationIdOrSlug: organization?.slug ?? ''},
      }),
      {query: {dsn: debouncedQuery}},
    ],
    {
      staleTime: 30_000,
      enabled: isDsn && !!organization,
    }
  );

  return useMemo(() => {
    if (!data) {
      return [];
    }

    return getDsnNavTargets(data).map(target => ({
      key: target.key,
      type: 'navigate' as const,
      to: target.to,
      display: {
        label: target.label,
        details: target.description,
        icon: ICON_MAP[target.key],
      },
      groupingKey: 'search-result',
    }));
  }, [data]);
}
