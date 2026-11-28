import {Tag} from '@sentry/scraps/badge';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';

import {AGENT_TAG, getEventTag, getImpactDisplay, getKindLabel} from './agentFeedback';

/**
 * What the agent said about its own report: how badly it was hurt, what kind
 * of problem it was, which tool, and which client and server were involved.
 */
export function AgentFeedbackSignals({eventData}: {eventData: Event}) {
  const impact = getEventTag(eventData, AGENT_TAG.impact);
  const kind = getEventTag(eventData, AGENT_TAG.kind);
  const tool = getEventTag(eventData, AGENT_TAG.tool);
  const clientFamily = getEventTag(eventData, AGENT_TAG.clientFamily);
  const serverVersion = getEventTag(eventData, AGENT_TAG.serverVersion);
  const transport = getEventTag(eventData, AGENT_TAG.transport);

  const impactDisplay = impact ? getImpactDisplay(impact) : null;

  return (
    <Flex gap="sm" wrap="wrap" align="center">
      {impactDisplay ? (
        <Tag variant={impactDisplay.variant}>{impactDisplay.label}</Tag>
      ) : null}
      {kind ? <Tag variant="info">{getKindLabel(kind)}</Tag> : null}
      {tool ? (
        <Tag variant="muted">
          <Text monospace size="xs" variant="inherit">
            {tool}
          </Text>
        </Tag>
      ) : null}
      {clientFamily ? (
        <Text size="sm" variant="muted">
          {t('Client: %s', clientFamily)}
        </Text>
      ) : null}
      {serverVersion ? (
        <Text size="sm" variant="muted">
          {t('Server: %s', serverVersion)}
          {transport ? ` (${transport})` : null}
        </Text>
      ) : null}
    </Flex>
  );
}
