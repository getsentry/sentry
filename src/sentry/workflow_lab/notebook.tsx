/* eslint-disable boundaries/no-unknown-files, import-js/no-extraneous-dependencies -- This standalone entrypoint consumes the Sentry frontend workspace dependencies. */
import {createRoot} from 'react-dom/client';
import {createBrowserRouter, RouterProvider} from 'react-router';
import {QueryClient, QueryClientProvider, useQuery} from '@tanstack/react-query';

import {commonInitialization} from 'sentry/bootstrap/commonInitialization';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {ThemeAndStyleProvider} from 'sentry/components/themeAndStyleProvider';
import {NuqsAdapter} from 'sentry/router/nuqsAdapter';
import {ScrapsProviders} from 'sentry/scrapsProviders';
import type {Organization} from 'sentry/types/organization';
import {OrganizationContext} from 'sentry/utils/organizationContext';
import {DEFAULT_QUERY_CLIENT_CONFIG} from 'sentry/utils/queryClientConfig';
import {InvestigationPageContent} from 'sentry/views/investigations/detail/investigationPageContent';
import {useInvestigationDetail} from 'sentry/views/investigations/detail/useInvestigationDetail';
import {useInvestigationTitle} from 'sentry/views/investigations/detail/useInvestigationTitle';
import type {InvestigationDetail} from 'sentry/views/investigations/types';
import {LLMContextProvider} from 'sentry/views/seerExplorer/contexts/llmContext';

function NotebookPage({investigation}: {investigation: InvestigationDetail}) {
  const title = useInvestigationTitle(investigation);
  return <InvestigationPageContent investigation={investigation} title={title} />;
}

function Notebook() {
  const id = new URLSearchParams(location.search).get('id') ?? '';
  const {data, error} = useInvestigationDetail(id);
  if (error) {
    return <p role="alert">{error.message}</p>;
  }
  return data ? <NotebookPage investigation={data} /> : <LoadingIndicator />;
}

function NotebookView() {
  const base = document.documentElement.dataset.organizationApi!;
  const org = useQuery({
    queryKey: ['organization', base],
    queryFn: async (): Promise<Organization> => {
      const response = await fetch(base + '?include_feature_flags=1');
      if (!response.ok) {
        throw new Error(`Sentry returned HTTP ${response.status}`);
      }
      return response.json();
    },
  });
  if (org.error) {
    return <p role="alert">{org.error.message}</p>;
  }
  if (!org.data) {
    return <LoadingIndicator />;
  }
  return (
    <OrganizationContext.Provider value={org.data}>
      <ScrapsProviders>
        <Notebook />
      </ScrapsProviders>
    </OrganizationContext.Provider>
  );
}

commonInitialization(window.__initialData);
const router = createBrowserRouter([
  {
    path: '*',
    element: (
      <NuqsAdapter>
        <LLMContextProvider>
          <NotebookView />
        </LLMContextProvider>
      </NuqsAdapter>
    ),
  },
]);
const client = new QueryClient(DEFAULT_QUERY_CLIENT_CONFIG);
createRoot(document.getElementById('notebook-root')!).render(
  <QueryClientProvider client={client}>
    <ThemeAndStyleProvider>
      <RouterProvider router={router} />
    </ThemeAndStyleProvider>
  </QueryClientProvider>
);
