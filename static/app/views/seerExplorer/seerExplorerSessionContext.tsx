import {createContext, useContext} from 'react';
import {skipToken, useQuery} from '@tanstack/react-query';

import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {ExplorerSession} from 'sentry/views/seerExplorer/types';
import {isSeerExplorerEnabled} from 'sentry/views/seerExplorer/utils';

function useSeerExplorerSessionsQuery({
  limit = 20,
  enabled = true,
}: {
  enabled?: boolean;
  limit?: number;
}) {
  const organization = useOrganization({allowNull: true});
  const isEnabled = enabled && isSeerExplorerEnabled(organization);

  return useQuery(
    apiOptions.as<{data: ExplorerSession[]}>()(
      '/organizations/$organizationIdOrSlug/seer/explorer-runs/',
      {
        path:
          isEnabled && organization
            ? {organizationIdOrSlug: organization.slug}
            : skipToken,
        query: {
          per_page: limit,
        },
        staleTime: 0,
      }
    )
  );
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

export function useSeerExplorerSessions(): SeerExplorerSessionsContextValue {
  const context = useContext(SeerExplorerSessionsContext);
  if (!context) {
    throw new Error(
      'useSeerExplorerSessionsContext must be used within a SeerExplorerSessionsProvider'
    );
  }
  return context;
}
