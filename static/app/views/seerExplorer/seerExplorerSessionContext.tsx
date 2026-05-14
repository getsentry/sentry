import {createContext, useContext} from 'react';
import {useQuery} from '@tanstack/react-query';

import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {ExplorerSession} from 'sentry/views/seerExplorer/types';
import {isSeerExplorerEnabled} from 'sentry/views/seerExplorer/utils';

export function makeSeerExplorerSessionsQueryOptions(orgSlug: string) {
  return apiOptions.as<{data: ExplorerSession[]}>()(
    '/organizations/$organizationIdOrSlug/seer/explorer-runs/',
    {
      path: {organizationIdOrSlug: orgSlug},
      query: {
        per_page: 20,
      },
      staleTime: 0,
    }
  );
}

function useSeerExplorerSessionsQuery({enabled = true}: {enabled?: boolean}) {
  const organization = useOrganization({allowNull: true});
  const isEnabled = enabled && isSeerExplorerEnabled(organization);

  return useQuery({
    ...makeSeerExplorerSessionsQueryOptions(organization?.slug ?? ''),
    enabled: isEnabled && !!organization,
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
