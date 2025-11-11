import {Fragment, useEffect, useEffectEvent, useLayoutEffect, useState} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import {Alert} from '@sentry/scraps/alert';
import {Container} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';

import {Button} from 'sentry/components/core/button';
import {t, tct, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {EventTransaction} from 'sentry/types/event';
import {defined} from 'sentry/utils';
import usePrevious from 'sentry/utils/usePrevious';
import type {
  TraceItemDetailsMeta,
  TraceItemResponseAttribute,
} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {
  getIsAiNode,
  getTraceNodeAttribute,
} from 'sentry/views/insights/pages/agents/utils/aiTraceNodes';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {FoldSection} from 'sentry/views/issueDetails/streamline/foldSection';
import {TraceDrawerComponents} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/styles';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {TraceTreeNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode';

interface AIMessage {
  content: React.ReactNode;
  role: string;
}

const ALLOWED_MESSAGE_ROLES = new Set(['system', 'user', 'assistant', 'tool']);

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

export function hasAIInputAttribute(
  node: TraceTreeNode<TraceTree.EAPSpan | TraceTree.Span | TraceTree.Transaction>,
  attributes?: TraceItemResponseAttribute[],
  event?: EventTransaction
) {
  return (
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
  attributesMeta,
  event,
}: {
  node: TraceTreeNode<TraceTree.EAPSpan | TraceTree.Span | TraceTree.Transaction>;
  attributes?: TraceItemResponseAttribute[];
  attributesMeta?: TraceItemDetailsMeta;
  event?: EventTransaction;
}) {
  const shouldRender = getIsAiNode(node) && hasAIInputAttribute(node, attributes, event);
  const messagesMeta = attributesMeta?.['gen_ai.request.messages']?.meta as any;
  const originalMessagesLength: number | undefined = messagesMeta?.['']?.len;

  let promptMessages = shouldRender
    ? getTraceNodeAttribute('gen_ai.request.messages', node, event, attributes)
    : null;

  if (!promptMessages && shouldRender) {
    const inputMessages = getTraceNodeAttribute(
      'ai.input_messages',
      node,
      event,
      attributes
    );
    promptMessages = inputMessages && transformInputMessages(inputMessages.toString());
  }
  if (!promptMessages && shouldRender) {
    const messages = getTraceNodeAttribute('ai.prompt', node, event, attributes);
    if (messages) {
      promptMessages = transformPrompt(messages.toString());
    }
  }

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
        <TraceDrawerComponents.MultilineText>
          {messages}
        </TraceDrawerComponents.MultilineText>
      ) : null}
      {Array.isArray(messages) ? (
        <MessagesArrayRenderer
          messages={messages}
          originalLength={originalMessagesLength}
        />
      ) : null}
      {toolArgs ? (
        <TraceDrawerComponents.MultilineJSON value={toolArgs} maxDefaultDepth={1} />
      ) : null}
      {embeddingsInput ? (
        <TraceDrawerComponents.MultilineText>
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
      <Alert type="muted">
        {tct(
          'Due to [link:size limitations], the oldest [count] got dropped from the history.',
          {
            count: tn('message', '%s messages', truncatedMessages),
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
  border-bottom: 1px dashed ${p => p.theme.border};
  display: flex;
  justify-content: center;
  align-items: center;
  margin: ${space(4)} 0;
`;
