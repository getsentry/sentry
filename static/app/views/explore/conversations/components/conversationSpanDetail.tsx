import {Fragment} from 'react';
import {css, useTheme} from '@emotion/react';
import {PlatformIcon} from 'platformicons';

import {Button} from '@sentry/scraps/button';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {TabList, TabPanels, TabStateProvider} from '@sentry/scraps/tabs';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {Placeholder} from 'sentry/components/placeholder';
import {IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils/defined';
import {getDuration} from 'sentry/utils/duration/getDuration';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import {capitalize} from 'sentry/utils/string/capitalize';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {useTraceItemDetails} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {getNodeTimeBounds} from 'sentry/views/insights/pages/agents/components/aiSpanList';
import {LLMCosts} from 'sentry/views/insights/pages/agents/components/llmCosts';
import {getModelPlatform} from 'sentry/views/insights/pages/agents/components/modelName';
import {
  getNumberAttr,
  getSpanColor,
  getStringAttr,
  getTimelineColorByOpType,
  getTraceNodeAttribute,
} from 'sentry/views/insights/pages/agents/utils/aiTraceNodes';
import type {AITraceSpanNode} from 'sentry/views/insights/pages/agents/utils/types';
import {SpanFields} from 'sentry/views/insights/types';
import {AIContentRenderer} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/span/eapSections/aiContentRenderer';
import {
  getAIInputMessages,
  getAIToolInput,
} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/span/eapSections/aiInput';
import {
  getAIOutputData,
  getAIToolOutput,
} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/span/eapSections/aiOutput';
import {AttributesContent} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/span/eapSections/attributes';
import {TraceDrawerComponents} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/styles';
import {isEAPSpanNode} from 'sentry/views/performance/newTraceDetails/traceGuards';

export type DetailTab = 'input' | 'output' | 'attributes';

export const CONVERSATION_SPAN_DETAIL_TABS: readonly DetailTab[] = [
  'input',
  'output',
  'attributes',
];

/** The fetched attribute list, or undefined while it's still loading. */
type SpanAttributes = Parameters<typeof getAIInputMessages>[1];

interface ConversationSpanDetailProps {
  activeTab: DetailTab;
  node: AITraceSpanNode;
  onClose: () => void;
  onTabChange: (tab: DetailTab) => void;
  traceId: string;
}

export function ConversationSpanDetail({
  node,
  traceId,
  activeTab,
  onTabChange,
  onClose,
}: ConversationSpanDetailProps) {
  const theme = useTheme();

  // Full attributes (tool inputs/results, the complete attribute list) aren't
  // returned by the conversation list endpoint, so they're fetched per span.
  const eapValue = isEAPSpanNode(node) ? node.value : null;
  const {data, isLoading, isError} = useTraceItemDetails({
    traceItemId: eapValue?.event_id ?? '',
    projectId: eapValue ? eapValue.project_id.toString() : '',
    traceId,
    traceItemType: TraceItemDataset.SPANS,
    referrer: 'api.explore.log-item-details',
    timestamp: eapValue?.start_timestamp,
    enabled: Boolean(eapValue),
  });
  const attributes = data?.attributes;

  const title = node.op || node.description || t('Span');
  const duration = getNodeTimeBounds(node).duration;
  const squareColor = getSpanColor(node, getTimelineColorByOpType(theme));

  return (
    <Stack
      background="primary"
      border="primary"
      radius="md"
      padding="xl"
      gap="lg"
      flex="1"
      minHeight="0"
    >
      <Flex align="center" gap="lg" flexShrink={0}>
        <Flex flex="1" minWidth="0" align="center" gap="md">
          <Container
            width="16px"
            height="16px"
            flexShrink={0}
            radius="2xs"
            style={{backgroundColor: squareColor}}
          />
          <Tooltip title={title} showOnlyOnOverflow skipWrapper>
            <Text size="md" bold ellipsis>
              {title}
            </Text>
          </Tooltip>
        </Flex>
        <Button
          size="sm"
          variant="transparent"
          icon={<IconClose />}
          aria-label={t('Close')}
          onClick={onClose}
        />
      </Flex>

      <Stack gap="md" flexShrink={0}>
        <Text size="md">{getDuration(duration, 2, true, true)}</Text>
        <SpanMetadata node={node} />
      </Stack>

      <TabStateProvider<DetailTab>
        value={activeTab}
        onChange={onTabChange}
        disableOverflow
      >
        <Flex flexShrink={0}>
          <TabList>
            <TabList.Item key="input">{t('Input')}</TabList.Item>
            <TabList.Item key="output">{t('Output')}</TabList.Item>
            <TabList.Item key="attributes">{t('Attributes')}</TabList.Item>
          </TabList>
        </Flex>

        <Container
          flex="1"
          minHeight="0"
          width="100%"
          overflowY="auto"
          overflowX="hidden"
        >
          <TabPanels
            css={css`
              padding-top: 0;
            `}
          >
            <TabPanels.Item key="input">
              <InputTab
                node={node}
                attributes={attributes}
                isLoading={isLoading}
                isError={isError}
              />
            </TabPanels.Item>
            <TabPanels.Item key="output">
              <OutputTab
                node={node}
                attributes={attributes}
                isLoading={isLoading}
                isError={isError}
              />
            </TabPanels.Item>
            <TabPanels.Item key="attributes">
              <AttributesTab
                node={node}
                attributes={attributes}
                isLoading={isLoading}
                isError={isError}
              />
            </TabPanels.Item>
          </TabPanels>
        </Container>
      </TabStateProvider>
    </Stack>
  );
}

function SpanMetadata({node}: {node: AITraceSpanNode}) {
  const agentName = getStringAttr(node, SpanFields.GEN_AI_AGENT_NAME);
  const tokens = getNumberAttr(node, SpanFields.GEN_AI_USAGE_TOTAL_TOKENS);
  const cost = getNumberAttr(node, SpanFields.GEN_AI_COST_TOTAL_TOKENS);
  const model =
    getStringAttr(node, SpanFields.GEN_AI_RESPONSE_MODEL) ||
    getStringAttr(node, SpanFields.GEN_AI_REQUEST_MODEL);

  const rows = [
    agentName ? {label: t('Agent Name'), value: <MetaValue text={agentName} />} : null,
    tokens
      ? {label: t('Tokens'), value: <MetaValue text={formatAbbreviatedNumber(tokens)} />}
      : null,
    cost
      ? {
          label: t('Spend'),
          value: (
            <Text size="xs">
              <LLMCosts cost={cost} />
            </Text>
          ),
        }
      : null,
    model
      ? {
          label: t('Model'),
          value: (
            <Flex gap="xs" align="center" minWidth="0">
              <PlatformIcon platform={getModelPlatform(model) ?? 'unknown'} size={16} />
              <Container minWidth="0">
                <MetaValue text={model} />
              </Container>
            </Flex>
          ),
        }
      : null,
  ].filter(defined);

  if (rows.length === 0) {
    return null;
  }

  return (
    <Grid columns="max-content minmax(0, 1fr)" gap="md lg" align="center">
      {rows.map(row => (
        <Fragment key={row.label}>
          <Text size="xs" variant="muted">
            {row.label}
          </Text>
          {row.value}
        </Fragment>
      ))}
    </Grid>
  );
}

function MetaValue({text}: {text: string}) {
  return (
    <Tooltip title={text} showOnlyOnOverflow skipWrapper>
      <Text size="xs" ellipsis>
        {text}
      </Text>
    </Tooltip>
  );
}

function InputTab({
  node,
  attributes,
  isLoading,
  isError,
}: {
  attributes: SpanAttributes;
  isError: boolean;
  isLoading: boolean;
  node: AITraceSpanNode;
}) {
  const {messages} = getAIInputMessages(node, attributes);
  const toolArgs = getAIToolInput(node, attributes);
  const embeddingsInput = getTraceNodeAttribute(
    'gen_ai.embeddings.input',
    node,
    undefined,
    attributes
  );

  const hasContent = (messages && messages.length > 0) || toolArgs || embeddingsInput;
  if (!hasContent) {
    return (
      <TabFallback
        isLoading={isLoading}
        isError={isError}
        emptyMessage={t('No input for this span')}
      />
    );
  }

  return (
    <Fragment>
      {messages?.map((message, index) => (
        <Fragment key={index}>
          <TraceDrawerComponents.MultilineTextLabel>
            {capitalize(message.role)}
          </TraceDrawerComponents.MultilineTextLabel>
          <MessageContent content={message.content} />
        </Fragment>
      ))}
      {toolArgs ? (
        <TraceDrawerComponents.MultilineJSON value={toolArgs} maxDefaultDepth={1} />
      ) : null}
      {embeddingsInput ? (
        <TraceDrawerComponents.MultilineText>
          {embeddingsInput.toString()}
        </TraceDrawerComponents.MultilineText>
      ) : null}
    </Fragment>
  );
}

function OutputTab({
  node,
  attributes,
  isLoading,
  isError,
}: {
  attributes: SpanAttributes;
  isError: boolean;
  isLoading: boolean;
  node: AITraceSpanNode;
}) {
  const {responseText, responseObject, toolCalls} = getAIOutputData(node, attributes);
  const toolOutput = getAIToolOutput(node, attributes);

  if (!responseText && !responseObject && !toolCalls && !toolOutput) {
    return (
      <TabFallback
        isLoading={isLoading}
        isError={isError}
        emptyMessage={t('No output for this span')}
      />
    );
  }

  return (
    <Fragment>
      {responseText ? (
        <Fragment>
          <TraceDrawerComponents.MultilineTextLabel>
            {t('Response')}
          </TraceDrawerComponents.MultilineTextLabel>
          <AIContentRenderer text={responseText} />
        </Fragment>
      ) : null}
      {responseObject ? (
        <Fragment>
          <TraceDrawerComponents.MultilineTextLabel>
            {t('Response Object')}
          </TraceDrawerComponents.MultilineTextLabel>
          <AIContentRenderer text={responseObject} />
        </Fragment>
      ) : null}
      {toolCalls ? (
        <Fragment>
          <TraceDrawerComponents.MultilineTextLabel>
            {t('Tool Calls')}
          </TraceDrawerComponents.MultilineTextLabel>
          <TraceDrawerComponents.MultilineJSON value={toolCalls} maxDefaultDepth={2} />
        </Fragment>
      ) : null}
      {toolOutput ? (
        <TraceDrawerComponents.MultilineJSON value={toolOutput} maxDefaultDepth={1} />
      ) : null}
    </Fragment>
  );
}

function MessageContent({content}: {content: unknown}) {
  return typeof content === 'string' ? (
    <AIContentRenderer text={content} />
  ) : (
    <TraceDrawerComponents.MultilineJSON value={content} maxDefaultDepth={2} />
  );
}

function AttributesTab({
  node,
  attributes,
  isLoading,
  isError,
}: {
  attributes: SpanAttributes;
  isError: boolean;
  isLoading: boolean;
  node: AITraceSpanNode;
}) {
  const theme = useTheme();
  const location = useLocation();
  const organization = useOrganization();
  const projectSlug = node.projectSlug;
  const {projects} = useProjects({slugs: projectSlug ? [projectSlug] : []});
  const project = projectSlug ? projects.find(p => p.slug === projectSlug) : undefined;

  if (!isEAPSpanNode(node)) {
    return <EmptyTab message={t('No attributes for this span')} />;
  }

  if (!attributes) {
    return (
      <TabFallback
        isLoading={isLoading}
        isError={isError}
        emptyMessage={t('No attributes for this span')}
      />
    );
  }

  return (
    <AttributesContent
      node={node}
      attributes={attributes}
      theme={theme}
      location={location}
      organization={organization}
      project={project}
    />
  );
}

/**
 * Fallback for a tab with no renderable content. Tool inputs/results and
 * embeddings aren't returned by the conversation list endpoint, so they only
 * appear once the per-span fetch resolves — show a placeholder while it's in
 * flight and an error state on failure so a pending or failed load isn't
 * mistaken for genuinely empty I/O.
 */
function TabFallback({
  isLoading,
  isError,
  emptyMessage,
}: {
  emptyMessage: string;
  isError: boolean;
  isLoading: boolean;
}) {
  if (isLoading) {
    return <Placeholder />;
  }
  if (isError) {
    return <EmptyTab message={t('Failed to load span details')} />;
  }
  return <EmptyTab message={emptyMessage} />;
}

function EmptyTab({message}: {message: string}) {
  return (
    <Flex flex="1" background="secondary" radius="md" padding="xl">
      <Text variant="muted">{message}</Text>
    </Flex>
  );
}
