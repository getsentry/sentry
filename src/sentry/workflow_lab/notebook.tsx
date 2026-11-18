/* eslint-disable boundaries/no-unknown-files, import-js/no-extraneous-dependencies -- This standalone entrypoint consumes the Sentry frontend workspace dependencies. */
import {createElement, useState} from 'react';
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
import type {Block as ExplorerBlock} from 'sentry/views/seerExplorer/types';

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

interface ActivityRun {
  nodes: Array<{attempts: Array<{session: {blocks: ExplorerBlock[]}}>}>;
  notebookId: string | null;
}

function NotebookActivity({runId, notebookId}: {notebookId: string; runId: string}) {
  const [open, setOpen] = useState(false);
  const activity = useQuery({
    queryKey: ['notebook-activity', slug, notebookId, runId],
    enabled: open,
    staleTime: Infinity,
    queryFn: async () => {
      const run = await read<ActivityRun>(
        base +
          'investigation-workflows/runs/' +
          encodeURIComponent(runId) +
          '/?activity=1'
      );
      if (run.notebookId !== notebookId) {
        throw new Error('This workflow run belongs to a different notebook.');
      }
      return run.nodes
        .flatMap(node => node.attempts.flatMap(attempt => attempt.session.blocks))
        .flatMap(block => {
          const calls = (block.tool_results ?? []).flatMap(result =>
            (result?.structuredContent?.calls ?? []).flatMap(call => {
              const title = call.llm_description || call.title;
              if (!title || (call.parent !== null && call.parent !== undefined)) {
                return [];
              }
              return [
                call.error || (call.status ?? 0) >= 400 ? title + ' (failed)' : title,
              ];
            })
          );
          const message =
            block.message.role === 'assistant' ? block.message.content : null;
          return message || calls.length
            ? [{id: block.id, at: block.timestamp, message, calls}]
            : [];
        })
        .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
    },
  });
  return (
    <details onToggle={event => setOpen(event.currentTarget.open)}>
      <summary>Agent activity</summary>
      {open &&
        (activity.isPending ? (
          <p>Loading agent activity…</p>
        ) : activity.error ? (
          <p role="alert">{activity.error.message}</p>
        ) : activity.data.length ? (
          <ol>
            {activity.data.map(entry => (
              <li key={entry.id}>
                {entry.message && <SeerMarkdown raw={entry.message} />}
                {entry.calls.join(' · ')}
              </li>
            ))}
          </ol>
        ) : (
          <p>No agent updates were recorded.</p>
        ))}
    </details>
  );
}

function NotebookView() {
  const org = useQuery({
    queryKey: ['organization', slug],
    queryFn: () => read<Organization>(base + '?include_feature_flags=1'),
  });
  const id = params.get('id') ?? '';
  const runId = params.get('run');
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
          {runId && params.get('live') === '0' && (
            <NotebookActivity runId={runId} notebookId={id} />
          )}
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
