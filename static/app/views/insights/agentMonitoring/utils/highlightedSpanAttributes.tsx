import {IconArrow} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {TraceItemResponseAttribute} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {hasAgentInsightsFeature} from 'sentry/views/insights/agentMonitoring/utils/features';

function ensureAttributeObject(
  attributes: Record<string, string> | TraceItemResponseAttribute[]
) {
  if (Array.isArray(attributes)) {
    return attributes.reduce(
      (acc, attribute) => {
        acc[attribute.name] = attribute.value.toString();
        return acc;
      },
      {} as Record<string, string>
    );
  }

  return attributes;
}

export function getHighlightedSpanAttributes(
  organization: Organization,
  attributes: Record<string, string> | undefined | TraceItemResponseAttribute[] = {}
) {
  if (!hasAgentInsightsFeature(organization)) {
    return [];
  }

  const attributeObject = ensureAttributeObject(attributes);
  const highlightedAttributes = [];

  if (attributeObject['ai.model.id']) {
    highlightedAttributes.push({
      name: t('Model'),
      value: attributeObject['ai.model.id'],
    });
  }

  const promptTokens = attributeObject['ai.prompt_tokens.used'];
  const completionTokens = attributeObject['ai.completion_tokens.used'];
  const totalTokens = attributeObject['ai.total_tokens.used'];
  if (promptTokens && completionTokens && totalTokens) {
    highlightedAttributes.push({
      name: t('Tokens'),
      value: (
        <span>
          {promptTokens} <IconArrow direction="right" size="xs" />{' '}
          {`${completionTokens} (Σ ${totalTokens})`}
        </span>
      ),
    });
  }

  if (attributeObject['ai.toolCall.name']) {
    highlightedAttributes.push({
      name: t('Tool Name'),
      value: attributeObject['ai.toolCall.name'],
    });
  }
  return highlightedAttributes;
}
