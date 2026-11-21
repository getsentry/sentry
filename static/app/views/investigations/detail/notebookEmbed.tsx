import {createElement, Fragment} from 'react';

import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {SeerEmbedRegistry} from 'sentry/components/seer/markdown/embeds';
import type {InvestigationBlock} from 'sentry/views/investigations/types';

export function NotebookEmbed({
  block,
}: {
  block: Pick<InvestigationBlock, 'embed' | 'embedSource' | 'embedSummary'>;
}) {
  const {embed, embedSource, embedSummary} = block;
  const widget = embed && SeerEmbedRegistry.get(embed.name);
  return (
    <Fragment>
      {widget && embed && (
        <ErrorBoundary mini>
          {createElement(widget, {name: embed.name, data: embed.body, level: 'block'})}
        </ErrorBoundary>
      )}
      {(embedSummary || embedSource) && <p>{embedSummary || embedSource}</p>}
    </Fragment>
  );
}
