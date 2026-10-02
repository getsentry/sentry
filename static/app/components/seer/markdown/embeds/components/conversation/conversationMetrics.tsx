import type {ReactNode} from 'react';

import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {Count} from 'sentry/components/count';
import {PerformanceDuration} from 'sentry/components/performanceDuration';
import {Placeholder} from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import {LLMCosts} from 'sentry/views/insights/pages/agents/components/llmCosts';

/**
 * The numbers a conversation embed reports. Both embeds -- the single
 * conversation block and the query block's table -- describe the same kind of
 * thing, so they report the same fields under the same labels.
 */
export interface ConversationMetrics {
  cost: number | null;
  errors: number;
  /**
   * Summed duration (ms) of the generation (`ai_client`) spans, not the
   * wall-clock span of the conversation: a conversation can sit idle for hours
   * between two messages.
   */
  generationDuration: number;
  messages: number;
}

export interface ConversationMetricField {
  key: string;
  label: string;
  render: (metrics: ConversationMetrics) => ReactNode;
  /**
   * `Text` variant for the value, so that a non-zero error count reads as an
   * error in the table and in the single block alike.
   */
  variant?: (metrics: ConversationMetrics) => 'danger' | undefined;
}

/**
 * The shared column set. Order is the order both embeds render them in.
 */
export const CONVERSATION_METRIC_FIELDS: ConversationMetricField[] = [
  {
    key: 'duration',
    label: t('Duration'),
    render: metrics => (
      <PerformanceDuration milliseconds={metrics.generationDuration} abbreviation />
    ),
  },
  {
    key: 'messages',
    label: t('Messages'),
    render: metrics => <Count value={metrics.messages} />,
  },
  {
    key: 'errors',
    label: t('Errors'),
    render: metrics => <Count value={metrics.errors} />,
    variant: metrics => (metrics.errors > 0 ? 'danger' : undefined),
  },
  {
    key: 'cost',
    label: t('Cost'),
    render: metrics => <LLMCosts cost={metrics.cost} />,
  },
];

/** Height of the `Text size="sm"` value the skeleton stands in for. */
const VALUE_HEIGHT = '14px';

/**
 * The single conversation block's counterpart to the query block's table
 * header plus row: the same fields, laid out inline because there is only ever
 * one conversation to describe.
 */
export function ConversationMetricsBar({
  metrics,
  isLoading,
}: {
  metrics: ConversationMetrics;
  isLoading?: boolean;
}) {
  return (
    <Flex align="center" gap="lg" minWidth={0} wrap="wrap">
      {CONVERSATION_METRIC_FIELDS.map(field => (
        <Flex key={field.key} align="center" gap="xs" flexShrink={0}>
          <Text size="sm" variant="muted">
            {field.label}
          </Text>
          {isLoading ? (
            <Placeholder width="28px" height={VALUE_HEIGHT} />
          ) : (
            <Text size="sm" bold tabular variant={field.variant?.(metrics)}>
              {field.render(metrics)}
            </Text>
          )}
        </Flex>
      ))}
    </Flex>
  );
}
