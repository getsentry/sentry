import {Fragment, useEffect, useEffectEvent, useLayoutEffect, useState} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import {Alert} from '@sentry/scraps/alert';
import {Container} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';

import {Button} from 'sentry/components/core/button';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {EventTransaction} from 'sentry/types/event';
import {defined} from 'sentry/utils';
import usePrevious from 'sentry/utils/usePrevious';
import type {TraceItemResponseAttribute} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {
  getIsAiNode,
  getTraceNodeAttribute,
} from 'sentry/views/insights/pages/agents/utils/aiTraceNodes';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {FoldSection} from 'sentry/views/issueDetails/streamline/foldSection';
import {TraceDrawerComponents} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/styles';
import type {EapSpanNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/eapSpanNode';
import type {SpanNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/spanNode';
import type {TransactionNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/transactionNode';

interface AIMessage {
  content: React.ReactNode;
  role: string;
}

const ALLOWED_MESSAGE_ROLES = new Set(['system', 'user', 'assistant', 'tool']);
const FILE_CONTENT_PARTS = ['blob', 'uri', 'file'] as const;
const SUPPORTED_CONTENT_PARTS = ['text', ...FILE_CONTENT_PARTS] as const;

function renderTextMessages(content: any) {
  if (!Array.isArray(content)) {
    return content;
  }
  return content
    .filter((part: any) => SUPPORTED_CONTENT_PARTS.includes(part.type))
    .map((part: any) =>
      FILE_CONTENT_PARTS.includes(part.type)
        ? `\n\n[redacted content of type "${part.mime_type ?? 'unknown'}"]\n\n`
        : part.text.trim()
    )
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
        if (!message.role || !message.content) {
          return null;
        }
        return {
          role: message.role,
          content:
            message.role === 'tool'
              ? renderToolMessage(message.content)
              : renderTextMessages(message.content),
        };
      })
      .filter(
        (message): message is Exclude<typeof message, null> =>
          message !== null && Boolean(message.content)
      );
  } catch (error) {
    try {
      Sentry.captureException(
        new Error('Error parsing ai.prompt.messages', {cause: error})
      );
    } catch {
      // ignore errors with browsers that don't support `cause`
    }
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
    try {
      Sentry.captureException(
        new Error('Error parsing ai.input_messages', {cause: error})
      );
    } catch {
      // ignore errors with browsers that don't support `cause`
    }
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
    try {
      Sentry.captureException(new Error('Error parsing ai.prompt', {cause: error}));
    } catch {
      // ignore errors with browsers that don't support `cause`
    }
    return undefined;
  }
}

/**
 * Transforms messages from the new parts-based format to the standard content format.
 * The new format uses a `parts` array with typed objects instead of a `content` field.
 */
function transformPartsMessages(messages: string): string | undefined {
  try {
    const parsed = JSON.parse(messages);
    if (!Array.isArray(parsed)) {
      return undefined;
    }

    const transformed = parsed.map((msg: any) => {
      if (!msg.parts || !Array.isArray(msg.parts)) {
        return msg; // Already in old format
      }

      // Concatenate all text parts
      const textContent = msg.parts
        .filter((p: any) => p.type === 'text')
        .map((p: any) => p.content || p.text)
        .filter(Boolean)
        .join('\n');

      // Handle different part types
      const toolCalls = msg.parts.filter((p: any) => p.type === 'tool_call');
      const toolResponses = msg.parts.filter((p: any) => p.type === 'tool_call_response');
      const objectParts = msg.parts.filter((p: any) => p.type === 'object');

      // Determine content: prefer text, then structured objects, then tool calls, then tool responses
      let content: any = textContent || undefined;
      if (!content && objectParts.length > 0) {
        // Structured output - keep as object for JSON rendering
        content = objectParts.length === 1 ? objectParts[0] : objectParts;
      } else if (!content && toolCalls.length > 0) {
        content = toolCalls;
      } else if (!content && toolResponses.length > 0) {
        content = toolResponses.map((r: any) => r.result).join('\n');
      }

      return {role: msg.role, content};
    });

    return JSON.stringify(transformed);
  } catch {
    return undefined;
  }
}

/**
 * Gets AI input messages, checking attributes in priority order.
 * Priority: gen_ai.input.messages > gen_ai.request.messages > ai.input_messages > ai.prompt
 * Also handles gen_ai.system_instructions by prepending as a system message.
 */
function getAIInputMessages(
  node: EapSpanNode | SpanNode | TransactionNode,
  attributes?: TraceItemResponseAttribute[],
  event?: EventTransaction
): string | null {
  const systemInstructions = getTraceNodeAttribute(
    'gen_ai.system_instructions',
    node,
    event,
    attributes
  );

  const inputMessages = getTraceNodeAttribute(
    'gen_ai.input.messages',
    node,
    event,
    attributes
  );
  if (inputMessages) {
    const transformed =
      transformPartsMessages(inputMessages.toString()) ?? inputMessages.toString();
    return prependSystemInstructions(transformed, systemInstructions?.toString());
  }

  const requestMessages = getTraceNodeAttribute(
    'gen_ai.request.messages',
    node,
    event,
    attributes
  );
  if (requestMessages) {
    return prependSystemInstructions(
      requestMessages.toString(),
      systemInstructions?.toString()
    );
  }

  const legacyInputMessages = getTraceNodeAttribute(
    'ai.input_messages',
    node,
    event,
    attributes
  );
  if (legacyInputMessages) {
    const transformed = transformInputMessages(legacyInputMessages.toString());
    if (transformed) {
      return prependSystemInstructions(transformed, systemInstructions?.toString());
    }
  }

  const prompt = getTraceNodeAttribute('ai.prompt', node, event, attributes);
  if (prompt) {
    const transformed = transformPrompt(prompt.toString());
    if (transformed) {
      return prependSystemInstructions(transformed, systemInstructions?.toString());
    }
  }

  if (systemInstructions) {
    return JSON.stringify([{role: 'system', content: systemInstructions.toString()}]);
  }

  return null;
}

/**
 * Prepends system instructions as a system role message to the messages array.
 */
function prependSystemInstructions(
  messagesJson: string,
  systemInstructions?: string
): string {
  if (!systemInstructions) {
    return messagesJson;
  }

  try {
    const messages = JSON.parse(messagesJson);
    if (!Array.isArray(messages)) {
      return messagesJson;
    }

    if (messages.length > 0 && messages[0].role === 'system') {
      return messagesJson;
    }

    return JSON.stringify([{role: 'system', content: systemInstructions}, ...messages]);
  } catch {
    return messagesJson;
  }
}

export function hasAIInputAttribute(
  node: EapSpanNode | SpanNode | TransactionNode,
  attributes?: TraceItemResponseAttribute[],
  event?: EventTransaction
) {
  return (
    getTraceNodeAttribute('gen_ai.input.messages', node, event, attributes) ||
    getTraceNodeAttribute('gen_ai.system_instructions', node, event, attributes) ||
    getTraceNodeAttribute('gen_ai.request.messages', node, event, attributes) ||
    getTraceNodeAttribute('gen_ai.tool.input', node, event, attributes) ||
    getTraceNodeAttribute('gen_ai.embeddings.input', node, event, attributes) ||
    getTraceNodeAttribute('ai.input_messages', node, event, attributes) ||
    getTraceNodeAttribute('ai.prompt', node, event, attributes)
  );
}

function useInvalidRoleDetection(roles: string[]) {
  const invalidRoles = roles.filter(role => !ALLOWED_MESSAGE_ROLES.has(role));
  const hasInvalidRoles = invalidRoles.length > 0;

  const captureMessage = useEffectEvent(() => {
    Sentry.captureMessage('Gen AI message with invalid role', {
      level: 'warning',
      tags: {
        feature: 'agent-monitoring',
        invalid_role_count: invalidRoles.length,
      },
      extra: {
        invalid_roles: invalidRoles,
        allowed_roles: Array.from(ALLOWED_MESSAGE_ROLES),
      },
    });
  });

  useEffect(() => {
    if (hasInvalidRoles) {
      captureMessage();
    }
  }, [hasInvalidRoles]);
}

export function AIInputSection({
  node,
  attributes,
  event,
}: {
  node: EapSpanNode | SpanNode | TransactionNode;
  attributes?: TraceItemResponseAttribute[];
  event?: EventTransaction;
}) {
  const shouldRender = getIsAiNode(node) && hasAIInputAttribute(node, attributes, event);
  const originalMessagesLength = getTraceNodeAttribute(
    'gen_ai.request.messages.original_length',
    node,
    event,
    attributes
  );

  const promptMessages = shouldRender
    ? getAIInputMessages(node, attributes, event)
    : null;

  const messages = defined(promptMessages) && parseAIMessages(promptMessages.toString());

  const toolArgs = getTraceNodeAttribute('gen_ai.tool.input', node, event, attributes);
  const embeddingsInput = getTraceNodeAttribute(
    'gen_ai.embeddings.input',
    node,
    event,
    attributes
  );

  const roles = Array.isArray(messages) ? messages.map(m => m.role) : [];
  useInvalidRoleDetection(roles);

  if ((!messages || messages.length === 0) && !toolArgs) {
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
        // We set the key to the node id to ensure the internal collapse state is reset when the user switches between nodes
        <TraceDrawerComponents.MultilineText key={node.id}>
          {messages}
        </TraceDrawerComponents.MultilineText>
      ) : null}
      {Array.isArray(messages) ? (
        <MessagesArrayRenderer
          key={node.id}
          messages={messages}
          originalLength={
            defined(originalMessagesLength) ? Number(originalMessagesLength) : undefined
          }
        />
      ) : null}
      {toolArgs ? (
        <TraceDrawerComponents.MultilineJSON
          key={node.id}
          value={toolArgs}
          maxDefaultDepth={1}
        />
      ) : null}
      {embeddingsInput ? (
        <TraceDrawerComponents.MultilineText key={node.id}>
          {embeddingsInput.toString()}
        </TraceDrawerComponents.MultilineText>
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
function MessagesArrayRenderer({
  messages,
  originalLength,
}: {
  messages: AIMessage[];
  originalLength?: number;
}) {
  const [isExpanded, setIsExpanded] = useState(messages.length <= MAX_MESSAGES_TO_SHOW);
  const truncatedMessages = originalLength ? originalLength - messages.length : 0;
  const isTruncated = truncatedMessages > 0;

  // Reset the expanded state when the messages length changes
  const previousMessagesLength = usePrevious(messages.length);
  useLayoutEffect(() => {
    if (previousMessagesLength !== messages.length) {
      setIsExpanded(messages.length <= MAX_MESSAGES_TO_SHOW);
    }
  }, [messages.length, previousMessagesLength]);

  const truncationAlert = isTruncated ? (
    <Container paddingBottom="lg">
      <Alert variant="muted">
        {tct(
          'Due to [link:size limitations], the oldest messages got dropped from the history.',
          {
            link: (
              <ExternalLink href="https://develop.sentry.dev/sdk/expected-features/data-handling/#variable-size" />
            ),
          }
        )}
      </Alert>
    </Container>
  ) : null;

  const renderMessage = (message: AIMessage, index: number) => {
    return (
      <Fragment key={index}>
        <RoleLabel>{message.role}</RoleLabel>
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
    return (
      <Fragment>
        {truncationAlert}
        {messages.map(renderMessage)}
      </Fragment>
    );
  }

  return (
    <Fragment>
      {truncationAlert}
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

const RoleLabel = styled(TraceDrawerComponents.MultilineTextLabel)`
  &::first-letter {
    text-transform: capitalize;
  }
`;

const ButtonDivider = styled('div')`
  height: 1px;
  width: 100%;
  border-bottom: 1px dashed ${p => p.theme.tokens.border.primary};
  display: flex;
  justify-content: center;
  align-items: center;
  margin: ${space(4)} 0;
`;
