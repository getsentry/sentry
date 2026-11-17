import {IconFire} from '@sentry/icons/fire';

import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import type {ToolError} from 'sentry/views/insights/pages/agents/utils/aiTraceNodes';

import {SpanErrorCard} from './spanErrorCard';

export function ToolErrorCard({
  error,
  className,
}: {
  error: ToolError;
  className?: string;
}) {
  return (
    <SpanErrorCard
      className={className}
      icon={<IconFire size="md" variant="danger" />}
      title={<Text bold>{error.type ?? t('Tool Error')}</Text>}
      message={
        error.message ? (
          <Text size="sm" wrap="pre-wrap" wordBreak="break-word">
            {error.message}
          </Text>
        ) : (
          <Text size="sm" variant="muted">
            {t('This tool call failed but has no associated issue.')}
          </Text>
        )
      }
    />
  );
}
