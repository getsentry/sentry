import {createContext} from 'react';
import {skipToken, useQuery} from '@tanstack/react-query';

import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {ExplorerSession} from 'sentry/views/seerExplorer/types';
import {isSeerExplorerEnabled} from 'sentry/views/seerExplorer/utils';

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
          // Scope the shared runs endpoint to the current user's Explorer
          // sessions; free-text search is appended as a title filter.
          query: ['is:mine', 'type:explorer', searchQuery?.trim()]
            .filter(Boolean)
            .join(' '),
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
