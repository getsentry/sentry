/* eslint-disable boundaries/no-unknown-files, import-js/no-extraneous-dependencies -- This standalone entrypoint consumes the Sentry frontend workspace dependencies. */
import {createElement} from 'react';
import {createRoot} from 'react-dom/client';
import {createBrowserRouter, RouterProvider} from 'react-router';
import {QueryClient, QueryClientProvider, useQuery} from '@tanstack/react-query';

import {Heading} from '@sentry/scraps/text';

import {commonInitialization} from 'sentry/bootstrap/commonInitialization';
import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {SeerMarkdown} from 'sentry/components/seer/markdown';
import {SeerEmbedRegistry} from 'sentry/components/seer/markdown/embeds';
import {ThemeAndStyleProvider} from 'sentry/components/themeAndStyleProvider';
import {NuqsAdapter} from 'sentry/router/nuqsAdapter';
import {ScrapsProviders} from 'sentry/scrapsProviders';
import type {Organization} from 'sentry/types/organization';
import {OrganizationContext} from 'sentry/utils/organizationContext';
import {DEFAULT_QUERY_CLIENT_CONFIG} from 'sentry/utils/queryClientConfig';

type Block = {
  content: string;
  embed: {body: Record<string, unknown>; name: string} | null;
  embedSource: string | null;
  embedSummary: string | null;
  id: string;
  producerKey: string | null;
  title: string;
};

interface Notebook {
  actionRequests: Array<{id: string; rationale: string; state: string; title: string}>;
  blocks: Block[];
  summary: string | null;
  summaryDescription: string | null;
  title: string;
}

async function read<T>(url: string): Promise<T> {
  const response = await fetch(url, {headers: {Accept: 'application/json'}});
  if (!response.ok) {
    throw new Error(`Sentry returned HTTP ${response.status}`);
  }
  return response.json();
}

const slug = document.documentElement.dataset.organization!;
const base = document.documentElement.dataset.organizationApi!;
const params = new URLSearchParams(location.search);

function NotebookView() {
  const org = useQuery({
    queryKey: ['organization', slug],
    queryFn: () => read<Organization>(base),
  });
  const id = params.get('id') ?? '';
  const notebook = useQuery({
    queryKey: ['notebook', slug, id],
    queryFn: () => read<Notebook>(base + 'notebooks/' + encodeURIComponent(id) + '/'),
    refetchInterval: params.get('live') === '1' ? 1500 : false,
  });
  const error = org.error || notebook.error;
  if (error) {
    return <p role="alert">{error.message}</p>;
  }
  if (!org.data || !notebook.data) {
    return <p>Loading notebook…</p>;
  }
  const doc = notebook.data;
  const firstHypothesis = doc.blocks.find(block =>
    block.producerKey?.startsWith('hypothesis-')
  );
  return (
    <OrganizationContext.Provider value={org.data}>
      <ScrapsProviders>
        <article style={{padding: 16}}>
          <Heading as="h2" size="xl">
            {doc.title}
          </Heading>
          {doc.summary && <p>{doc.summary}</p>}
          {doc.summaryDescription && <SeerMarkdown raw={doc.summaryDescription} />}
          {doc.blocks.map(block => {
            const widget = block.embed && SeerEmbedRegistry.get(block.embed.name);
            return (
              <section key={block.id} style={{marginBottom: 16}}>
                {block === firstHypothesis && (
                  <Heading as="h3" size="lg">
                    Hypotheses
                  </Heading>
                )}
                {block.title && (
                  <Heading as="h3" size="lg">
                    {block.title}
                  </Heading>
                )}
                <ErrorBoundary mini>
                  {widget && block.embed
                    ? createElement(widget, {
                        name: block.embed.name,
                        data: block.embed.body,
                        level: 'block',
                      })
                    : block.content && <SeerMarkdown raw={block.content} />}
                </ErrorBoundary>
                {(block.embedSummary || block.embedSource) && (
                  <p>{block.embedSummary || block.embedSource}</p>
                )}
              </section>
            );
          })}
          {doc.actionRequests.length > 0 && (
            <section>
              <Heading as="h3" size="lg">
                Next steps
              </Heading>
              <ol>
                {doc.actionRequests.map(step => (
                  <li key={step.id}>
                    <strong>{step.title}</strong> · {step.state}
                    <SeerMarkdown raw={step.rationale} />
                  </li>
                ))}
              </ol>
            </section>
          )}
        </article>
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
        <NotebookView />
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
