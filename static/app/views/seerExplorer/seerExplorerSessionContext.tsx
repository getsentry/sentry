import {createContext} from 'react';
import {skipToken, useQuery} from '@tanstack/react-query';

import {escapeDoubleQuotes} from 'sentry/utils';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {ExplorerSession} from 'sentry/views/seerExplorer/types';
import {isSeerExplorerEnabled} from 'sentry/views/seerExplorer/utils';

// Quote free-text search so the runs search grammar treats it as a title
// filter rather than parsing filter-like input (`foo:bar`) and returning 400.
export function buildRunsSearchQuery(searchQuery?: string) {
  const trimmed = searchQuery?.trim();
  return [
    'is:mine',
    'type:explorer',
    trimmed ? `"${escapeDoubleQuotes(trimmed)}"` : undefined,
  ]
    .filter(Boolean)
    .join(' ');
}

export function useSeerExplorerSessionsQuery({
  limit = 20,
  enabled = true,
  query: searchQuery,
}: {
  enabled?: boolean;
  limit?: number;
  query?: string;
}) {
  const organization = useOrganization({allowNull: true});
  const isEnabled = enabled && isSeerExplorerEnabled(organization);

  return useQuery({
    ...apiOptions.as<ExplorerSession[]>()(
      '/organizations/$organizationIdOrSlug/seer/runs/',
      {
        path:
          isEnabled && organization
            ? {organizationIdOrSlug: organization.slug}
            : skipToken,
        query: {
          per_page: limit,
          query: buildRunsSearchQuery(searchQuery),
        },
        staleTime: 0,
      }
    ),
  });
}

type SeerExplorerSessionsContextValue = ReturnType<typeof useSeerExplorerSessionsQuery>;

const SeerExplorerSessionsContext =
  createContext<SeerExplorerSessionsContextValue | null>(null);

interface SeerExplorerSessionsProviderProps {
  children: React.ReactNode;
}

export function SeerExplorerSessionsProvider(props: SeerExplorerSessionsProviderProps) {
  const organization = useOrganization({allowNull: true});

  const query = useSeerExplorerSessionsQuery({
    limit: 20,
    enabled: isSeerExplorerEnabled(organization),
  });

  return (
    <SeerExplorerSessionsContext.Provider value={query}>
      {props.children}
    </SeerExplorerSessionsContext.Provider>
  );
}
