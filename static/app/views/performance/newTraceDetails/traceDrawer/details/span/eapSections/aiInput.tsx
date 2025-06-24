import {Fragment} from 'react';
import * as Sentry from '@sentry/react';

import {StructuredData} from 'sentry/components/structuredEventData';
import {t} from 'sentry/locale';
import type {EventTransaction} from 'sentry/types/event';
import {defined} from 'sentry/utils';
import useOrganization from 'sentry/utils/useOrganization';
import type {TraceItemResponseAttribute} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {hasAgentInsightsFeature} from 'sentry/views/insights/agentMonitoring/utils/features';
import {
  getIsAiNode,
  getTraceNodeAttribute,
} from 'sentry/views/insights/agentMonitoring/utils/highlightedSpanAttributes';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {FoldSection} from 'sentry/views/issueDetails/streamline/foldSection';
import {TraceDrawerComponents} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/styles';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {TraceTreeNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode';

function renderTextMessages(content: any) {
  if (!Array.isArray(content)) {
    return content;
  }
  return content
    .filter((part: any) => part.type === 'text')
    .map((part: any) => part.text.trim())
    .join('\n');
}

function renderToolMessage(content: any) {
  return <StructuredData value={content} maxDefaultDepth={2} withAnnotatedText />;
}

function parseAIMessages(messages: string) {
  try {
    const array: any[] = Array.isArray(messages) ? messages : JSON.parse(messages);
    return array
      .map((message: any) => {
        switch (message.role) {
          case 'system':
            return {
              role: 'system' as const,
              content: renderTextMessages(message.content),
            };
          case 'user':
            return {
              role: 'user' as const,
              content: renderTextMessages(message.content),
            };
          case 'assistant':
            return {
              role: 'assistant' as const,
              content: renderTextMessages(message.content),
            };
          case 'tool':
            return {
              role: 'tool' as const,
              content: renderToolMessage(message.content),
            };
          default:
            Sentry.captureMessage('Unknown AI message role', {
              extra: {
                role: message.role,
              },
            });
            return null;
        }
      })
      .filter(
        (message): message is Exclude<typeof message, null> =>
          message !== null && Boolean(message.content)
      );
  } catch (error) {
    Sentry.captureMessage('Error parsing ai.prompt.messages', {
      extra: {
        error,
      },
    });
    return messages;
  }
}

function transformInputMessages(inputMessages: string) {
  try {
    const json = JSON.parse(inputMessages);
    const result = [];
    const {system, prompt} = json;
    if (system) {
      result.push({
        role: 'system',
        content: system,
      });
    }
    if (prompt) {
      result.push({
        role: 'user',
        content: [{type: 'text', text: prompt}],
      });
    }
    return JSON.stringify(result);
  } catch (error) {
    Sentry.captureMessage('Error parsing ai.input_messages', {
      extra: {
        error,
      },
    });
    return undefined;
  }
}

const roleHeadings = {
  system: t('System'),
  user: t('User'),
  assistant: t('Assistant'),
  tool: t('Tool'),
};

export function AIInputSection({
  node,
  attributes,
  event,
}: {
  node: TraceTreeNode<TraceTree.EAPSpan | TraceTree.Span | TraceTree.Transaction>;
  attributes?: TraceItemResponseAttribute[];
  event?: EventTransaction;
}) {
  const organization = useOrganization();
  if (!hasAgentInsightsFeature(organization) && getIsAiNode(node)) {
    return null;
  }

  let promptMessages = getTraceNodeAttribute(
    'gen_ai.request.messages',
    node,
    event,
    attributes
  );
  if (!promptMessages) {
    const inputMessages = getTraceNodeAttribute(
      'ai.input_messages',
      node,
      event,
      attributes
    );
    promptMessages = inputMessages && transformInputMessages(inputMessages);
  }

  const messages = defined(promptMessages) && parseAIMessages(promptMessages);

  const toolArgs = getTraceNodeAttribute('gen_ai.tool.input', node, event, attributes);

  if (!messages && !toolArgs) {
    return null;
  }

  return (
    <FoldSection
      sectionKey={SectionKey.AI_INPUT}
      title={t('Input')}
      disableCollapsePersistence
    >
      {/* If parsing fails, we'll just show the raw string */}
      {typeof messages === 'string' ? (
        <TraceDrawerComponents.MultilineText>
          {messages}
        </TraceDrawerComponents.MultilineText>
      ) : messages ? (
        <Fragment>
          {messages.map((message, index) => (
            <Fragment key={index}>
              <TraceDrawerComponents.MultilineTextLabel>
                {roleHeadings[message.role]}
              </TraceDrawerComponents.MultilineTextLabel>
              <TraceDrawerComponents.MultilineText>
                {message.content}
              </TraceDrawerComponents.MultilineText>
            </Fragment>
          ))}
        </Fragment>
      ) : null}
      {toolArgs ? (
        <TraceDrawerComponents.MultilineJSON value={toolArgs} maxDefaultDepth={1} />
      ) : null}
    </FoldSection>
  );
}
