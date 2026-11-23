import {Text} from '@sentry/scraps/text';

import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {SeerEmbed} from 'sentry/components/seer/markdown';
import type {SeerEmbedBlockHostActions} from 'sentry/components/seer/markdown/embeds/components/seerEmbedBlock';
import {t} from 'sentry/locale';
import type {InvestigationBlock} from 'sentry/views/investigations/types';

export function NotebookEmbed({
  block,
  hostActions,
}: {
  block: Pick<InvestigationBlock, 'embed' | 'embedSource' | 'embedSummary'>;
  hostActions?: SeerEmbedBlockHostActions;
}) {
  const {embed, embedSource, embedSummary} = block;
  const fallback = <Text>{embedSummary || embedSource || t('Widget unavailable')}</Text>;
  if (!embed) {
    return fallback;
  }
  return (
    <ErrorBoundary mini>
      <SeerEmbed
        name={embed.name}
        data={embed.body}
        level="block"
        hostActions={hostActions}
        fallback={fallback}
      />
    </ErrorBoundary>
  );
}
