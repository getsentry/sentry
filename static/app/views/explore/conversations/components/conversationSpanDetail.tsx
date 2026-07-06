import {Fragment, useEffect, useRef} from 'react';
import {css, useTheme} from '@emotion/react';

import {Tag} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {TabList, TabPanels, TabStateProvider} from '@sentry/scraps/tabs';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {Placeholder} from 'sentry/components/placeholder';
import {IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import {getDuration} from 'sentry/utils/duration/getDuration';
import {capitalize} from 'sentry/utils/string/capitalize';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {useTraceItemDetails} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {getNodeTimeBounds} from 'sentry/views/insights/pages/agents/components/aiSpanList';
import {
  getSpanColor,
  getTimelineColorByOpType,
  getTraceNodeAttribute,
} from 'sentry/views/insights/pages/agents/utils/aiTraceNodes';
import type {AITraceSpanNode} from 'sentry/views/insights/pages/agents/utils/types';
import {
  getDurationComparison,
  MIN_PCT_DURATION_DIFFERENCE,
} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/durationComparison';
import {getHighlightedSpanAttributes} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/highlightedAttributes';
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
  onTabChange: (tab: DetailTab) => void;
  traceId: string;
  /**
   * Average duration (in seconds) to compare this span against. When provided,
   * a "faster/slower than avg" pill is shown next to the duration.
   */
  avgDuration?: number;
  /**
   * Embeds the panel flush inside another surface (trace views), dropping the
   * border and radius. Off, it renders as a standalone bordered card.
   */
  embedded?: boolean;
  /** When provided, a close button is shown in the header. */
  onClose?: () => void;
}

export function ConversationSpanDetail({
  node,
  traceId,
  activeTab,
  onTabChange,
  onClose,
  avgDuration,
  embedded,
}: ConversationSpanDetailProps) {
  const theme = useTheme();
  const tabContentRef = useRef<HTMLDivElement>(null);

  // Reset the scroll position to the top when switching tabs, otherwise the
  // shared scroll container keeps the previous tab's offset. In the fixed-height
  // layout the tab container is its own scroll region; on narrow screens it
  // flows into the page's scroll container, so scrolling it is a no-op — bring
  // its top back into view instead.
  useEffect(() => {
    const el = tabContentRef.current;
    if (!el) {
      return;
    }
    if (getComputedStyle(el).overflowY === 'visible') {
      el.scrollIntoView({block: 'start'});
    } else {
      el.scrollTo({top: 0});
    }
  }, [activeTab]);

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
  const comparison = getDurationComparison(
    avgDuration,
    duration,
    t('Average duration for this span over the last 24 hours')
  );

  return (
    <Stack
      background="primary"
      border={embedded ? undefined : 'primary'}
      radius={embedded ? undefined : 'md'}
      padding="xl"
      gap="lg"
      flex="1"
      minWidth="0"
      minHeight="0"
      height={embedded ? '100%' : {xs: 'auto', md: '100%'}}
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
        {onClose ? (
          <Button
            size="sm"
            variant="transparent"
            icon={<IconClose />}
            aria-label={t('Close')}
            onClick={onClose}
          />
        ) : null}
      </Flex>

      <Stack gap="md" flexShrink={0}>
        <Flex align="center" gap="sm" wrap="wrap">
          <Text size="md">{getDuration(duration, 2, true, true)}</Text>
          {duration > 0 &&
          comparison &&
          comparison.deltaPct >= MIN_PCT_DURATION_DIFFERENCE ? (
            <Tag variant={comparison.variant}>{comparison.deltaText}</Tag>
          ) : null}
        </Flex>
        <SpanMetadata node={node} attributes={attributes} />
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
          ref={tabContentRef}
          flex={embedded ? '1' : {xs: '0 0 auto', md: '1'}}
          minHeight="0"
          width="100%"
          overflowY={embedded ? 'auto' : {xs: 'visible', md: 'auto'}}
          overflowX={embedded ? 'hidden' : {xs: 'visible', md: 'hidden'}}
          // Gutter so the scroll container doesn't clip a focused input's focus ring.
          padding="xs"
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

function SpanMetadata({
  node,
  attributes,
}: {
  attributes: SpanAttributes;
  node: AITraceSpanNode;
}) {
  const rows = getHighlightedSpanAttributes({
    op: node.op,
    spanId: node.id,
    attributes: attributes ?? node.attributes,
  });

  if (rows.length === 0) {
    return null;
  }

  return (
    <Grid columns="max-content minmax(0, 1fr)" gap="md lg" align="center">
      {rows.map(row => (
        <Fragment key={row.name}>
          <Text size="xs" variant="muted">
            {row.name}
          </Text>
          <Container minWidth="0">
            {typeof row.value === 'string' ? (
              <Text size="xs" as="div" ellipsis>
                {row.value}
              </Text>
            ) : (
              <Text size="xs" as="div">
                {row.value}
              </Text>
            )}
          </Container>
        </Fragment>
      ))}
    </Grid>
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
