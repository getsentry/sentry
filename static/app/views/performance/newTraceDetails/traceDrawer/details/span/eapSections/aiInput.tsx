import {Fragment, useLayoutEffect, useState} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import {Button} from 'sentry/components/core/button';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {EventTransaction} from 'sentry/types/event';
import {defined} from 'sentry/utils';
import useOrganization from 'sentry/utils/useOrganization';
import usePrevious from 'sentry/utils/usePrevious';
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

type AIMessageRole = 'system' | 'user' | 'assistant' | 'tool';

interface AIMessage {
  content: React.ReactNode;
  role: AIMessageRole;
}

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
  return content;
}

function parseAIMessages(messages: string): AIMessage[] | string {
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

function transformPrompt(prompt: string) {
  try {
    const json = JSON.parse(prompt);
    const result = [];
    const {system, messages} = json;
    if (system) {
      result.push({
        role: 'system',
        content: system,
      });
    }
    const parsedMessages = parseAIMessages(messages);
    if (parsedMessages) {
      result.push(...parsedMessages);
    }
    return JSON.stringify(result);
  } catch (error) {
    Sentry.captureMessage('Error parsing ai.prompt', {
      extra: {
        error,
      },
    });
    return undefined;
  }
}

const roleHeadings: Record<AIMessageRole, string> = {
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
  if (!promptMessages) {
    const messages = getTraceNodeAttribute('ai.prompt', node, event, attributes);
    if (messages) {
      promptMessages = transformPrompt(messages);
    }
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
      ) : null}
      {Array.isArray(messages) ? <MessagesArrayRenderer messages={messages} /> : null}
      {toolArgs ? (
        <TraceDrawerComponents.MultilineJSON value={toolArgs} maxDefaultDepth={1} />
      ) : null}
    </FoldSection>
  );
}

const MAX_MESSAGES_AT_START = 2;
const MAX_MESSAGES_AT_END = 1;
const MAX_MESSAGES_TO_SHOW = MAX_MESSAGES_AT_START + MAX_MESSAGES_AT_END;

/**
 * As the whole message history takes up too much space we only show the first two (as those often contain the system and initial user prompt)
 * and the last messages with the option to expand
 */
function MessagesArrayRenderer({messages}: {messages: AIMessage[]}) {
  const [isExpanded, setIsExpanded] = useState(messages.length <= MAX_MESSAGES_TO_SHOW);

  // Reset the expanded state when the messages length changes
  const previousMessagesLength = usePrevious(messages.length);
  useLayoutEffect(() => {
    if (previousMessagesLength !== messages.length) {
      setIsExpanded(messages.length <= MAX_MESSAGES_TO_SHOW);
    }
  }, [messages.length, previousMessagesLength]);

  const renderMessage = (message: AIMessage, index: number) => {
    return (
      <Fragment key={index}>
        <TraceDrawerComponents.MultilineTextLabel>
          {roleHeadings[message.role]}
        </TraceDrawerComponents.MultilineTextLabel>
        {typeof message.content === 'string' ? (
          <TraceDrawerComponents.MultilineText>
            {message.content}
          </TraceDrawerComponents.MultilineText>
        ) : (
          <TraceDrawerComponents.MultilineJSON
            value={message.content}
            maxDefaultDepth={2}
          />
        )}
      </Fragment>
    );
  };

  if (isExpanded) {
    return messages.map(renderMessage);
  }

  return (
    <Fragment>
      {messages.slice(0, MAX_MESSAGES_AT_START).map(renderMessage)}
      <ButtonDivider>
        <Button onClick={() => setIsExpanded(true)} size="xs">
          {t('+%s more messages', messages.length - MAX_MESSAGES_TO_SHOW)}
        </Button>
      </ButtonDivider>
      {messages.slice(-MAX_MESSAGES_AT_END).map(renderMessage)}
    </Fragment>
  );
}

const ButtonDivider = styled('div')`
  height: 1px;
  width: 100%;
  border-bottom: 1px dashed ${p => p.theme.border};
  display: flex;
  justify-content: center;
  align-items: center;
  margin: ${space(4)} 0;
`;
