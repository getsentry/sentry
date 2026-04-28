import {Fragment, useEffect, useEffectEvent, useLayoutEffect, useState} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {Container} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';

import {t, tct} from 'sentry/locale';
import type {EventTransaction} from 'sentry/types/event';
import {usePrevious} from 'sentry/utils/usePrevious';
import type {TraceItemResponseAttribute} from 'sentry/views/explore/hooks/useTraceItemDetails';
import type {AIMessage} from 'sentry/views/insights/pages/agents/utils/aiMessageNormalizer';
import {normalizeToMessages} from 'sentry/views/insights/pages/agents/utils/aiMessageNormalizer';
import {
  getIsAiNode,
  getTraceNodeAttribute,
} from 'sentry/views/insights/pages/agents/utils/aiTraceNodes';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {FoldSection} from 'sentry/views/issueDetails/streamline/foldSection';
import {AIContentRenderer} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/span/eapSections/aiContentRenderer';
import {TraceDrawerComponents} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/styles';
import type {EapSpanNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/eapSpanNode';
import type {SpanNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/spanNode';
import type {TransactionNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/transactionNode';

const ALLOWED_MESSAGE_ROLES = new Set(['system', 'user', 'assistant', 'tool']);

const INPUT_ATTRIBUTES = [
  'gen_ai.input.messages',
  'gen_ai.request.messages',
  'ai.input_messages',
  'ai.prompt',
] as const;

const INPUT_PRESENCE_ATTRIBUTES = [
  ...INPUT_ATTRIBUTES,
  'gen_ai.system_instructions',
  'gen_ai.tool.call.arguments',
  'gen_ai.tool.input',
  'gen_ai.embeddings.input',
] as const;

export function AIInputSection({
  node,
  attributes,
  event,
  initialCollapse,
}: {
  node: EapSpanNode | SpanNode | TransactionNode;
  attributes?: TraceItemResponseAttribute[];
  event?: EventTransaction;
  initialCollapse?: boolean;
}) {
  const shouldRender = getIsAiNode(node) && hasAIInputAttribute(node, attributes, event);

  const {messages, fixedInvalidJson} = shouldRender
    ? getAIInputMessages(node, attributes, event)
    : {messages: null, fixedInvalidJson: false};

  const toolArgs = getAIToolInput(node, attributes, event);
  const embeddingsInput = getTraceNodeAttribute(
    'gen_ai.embeddings.input',
    node,
    event,
    attributes
  );
  const originalMessagesLength = getTraceNodeAttribute(
    'gen_ai.request.messages.original_length',
    node,
    event,
    attributes
  );

  const roles = messages?.map(m => m.role) ?? [];
  useInvalidRoleDetection(roles);

  if ((!messages || messages.length === 0) && !toolArgs) {
    return null;
  }

  return (
    <FoldSection
      key={node.id}
      sectionKey={SectionKey.AI_INPUT}
      title={t('Input')}
      disableCollapsePersistence
      initialCollapse={initialCollapse}
    >
      {messages && messages.length > 0 ? (
        <MessagesArrayRenderer
          key={node.id}
          messages={messages}
          originalLength={
            originalMessagesLength === undefined || originalMessagesLength === null
              ? undefined
              : Number(originalMessagesLength)
          }
          fixedInvalidJson={fixedInvalidJson}
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

export function hasAIInputAttribute(
  node: EapSpanNode | SpanNode | TransactionNode,
  attributes?: TraceItemResponseAttribute[],
  event?: EventTransaction
) {
  return INPUT_PRESENCE_ATTRIBUTES.some(key =>
    getTraceNodeAttribute(key, node, event, attributes)
  );
}

/**
 * Gets AI input messages, checking attributes in priority order:
 * `gen_ai.input.messages` > `gen_ai.request.messages` > `ai.input_messages` > `ai.prompt`.
 *
 * Every attribute runs through the same normalizer, so any supported shape
 * (parts, content, {system, prompt}, {messages: ...}, plain string) works on
 * any attribute. System instructions are prepended to the resulting array.
 */
function getAIInputMessages(
  node: EapSpanNode | SpanNode | TransactionNode,
  attributes?: TraceItemResponseAttribute[],
  event?: EventTransaction
): {fixedInvalidJson: boolean; messages: AIMessage[] | null} {
  const systemInstructions = getTraceNodeAttribute(
    'gen_ai.system_instructions',
    node,
    event,
    attributes
  );

  for (const key of INPUT_ATTRIBUTES) {
    const raw = getTraceNodeAttribute(key, node, event, attributes);
    if (!raw) {
      continue;
    }
    const {messages, fixedInvalidJson} = normalizeToMessages(raw.toString(), {
      defaultRole: 'user',
    });
    if (messages && messages.length > 0) {
      return {
        messages: prependSystemInstructions(messages, systemInstructions?.toString()),
        fixedInvalidJson,
      };
    }
  }

  if (systemInstructions) {
    return {
      messages: [{role: 'system', content: systemInstructions.toString()}],
      fixedInvalidJson: false,
    };
  }

  return {messages: null, fixedInvalidJson: false};
}

function prependSystemInstructions(
  messages: AIMessage[],
  systemInstructions: string | undefined
): AIMessage[] {
  if (!systemInstructions) {
    return messages;
  }
  if (messages.length > 0 && messages[0]!.role === 'system') {
    return messages;
  }
  return [{role: 'system', content: systemInstructions}, ...messages];
}

function getAIToolInput(
  node: EapSpanNode | SpanNode | TransactionNode,
  attributes?: TraceItemResponseAttribute[],
  event?: EventTransaction
) {
  return (
    getTraceNodeAttribute('gen_ai.tool.call.arguments', node, event, attributes) ??
    getTraceNodeAttribute('gen_ai.tool.input', node, event, attributes)
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

const MAX_MESSAGES_AT_START = 2;
const MAX_MESSAGES_AT_END = 1;
const MAX_MESSAGES_TO_SHOW = MAX_MESSAGES_AT_START + MAX_MESSAGES_AT_END;

function MessagesArrayRenderer({
  messages,
  originalLength,
  fixedInvalidJson,
}: {
  fixedInvalidJson: boolean;
  messages: AIMessage[];
  originalLength?: number;
}) {
  const [isExpanded, setIsExpanded] = useState(messages.length <= MAX_MESSAGES_TO_SHOW);
  const truncatedMessages = originalLength ? originalLength - messages.length : 0;
  const isTruncated = truncatedMessages > 0;

  const previousMessagesLength = usePrevious(messages.length);
  useLayoutEffect(() => {
    if (previousMessagesLength !== messages.length) {
      setIsExpanded(messages.length <= MAX_MESSAGES_TO_SHOW);
    }
  }, [messages.length, previousMessagesLength]);

  const renderMessage = (message: AIMessage, index: number) => {
    return (
      <Fragment key={index}>
        <RoleLabel>{message.role}</RoleLabel>
        {typeof message.content === 'string' ? (
          <AIContentRenderer text={message.content} />
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
        <TruncationAlert
          areOldMessagesTruncated={isTruncated}
          fixedInvalidJson={fixedInvalidJson}
        />
        {messages.map(renderMessage)}
      </Fragment>
    );
  }

  return (
    <Fragment>
      <TruncationAlert
        areOldMessagesTruncated={isTruncated}
        fixedInvalidJson={fixedInvalidJson}
      />
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

function TruncationAlert({
  areOldMessagesTruncated,
  fixedInvalidJson,
}: {
  areOldMessagesTruncated: boolean;
  fixedInvalidJson: boolean;
}) {
  if (!areOldMessagesTruncated && !fixedInvalidJson) {
    return null;
  }

  const link = (
    <ExternalLink href="https://develop.sentry.dev/sdk/expected-features/data-handling/#variable-size" />
  );

  return (
    <Container paddingBottom="lg">
      <Alert variant="muted">
        {areOldMessagesTruncated
          ? tct(
              'Due to [link:size limitations], the oldest messages got dropped from the history.',
              {link}
            )
          : tct('Due to [link:size limitations], the content was truncated.', {link})}
        {fixedInvalidJson ? ` ${t('Truncated parts are marked with (~~).')}` : null}
      </Alert>
    </Container>
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
  margin: ${p => p.theme.space['3xl']} 0;
`;
