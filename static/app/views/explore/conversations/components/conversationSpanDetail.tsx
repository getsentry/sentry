import {Fragment, useEffect, useRef} from 'react';
import {css, useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Tag} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {InfoText} from '@sentry/scraps/info';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {TabList, TabPanels, TabStateProvider} from '@sentry/scraps/tabs';
import {Text} from '@sentry/scraps/text';

import {Placeholder} from 'sentry/components/placeholder';
import {IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import {getDuration} from 'sentry/utils/duration/getDuration';
import {capitalize} from 'sentry/utils/string/capitalize';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {SpanDetailCard} from 'sentry/views/explore/conversations/components/conversationLayout';
import {useTraceItemDetails} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {getNodeTimeBounds} from 'sentry/views/insights/pages/agents/components/aiSpanList';
import {AiSpanStatusIcon} from 'sentry/views/insights/pages/agents/components/aiSpanStatusIcon';
import {getTraceNodeAttribute} from 'sentry/views/insights/pages/agents/utils/aiTraceNodes';
import type {AITraceSpanNode} from 'sentry/views/insights/pages/agents/utils/types';
import {
  getDurationComparison,
  MIN_PCT_DURATION_DIFFERENCE,
} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/durationComparison';
import {getHighlightedSpanAttributes} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/highlightedAttributes';
import {IssueList} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/issues/issues';
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
import {traceGridCssVariables} from 'sentry/views/performance/newTraceDetails/traceWaterfallStyles';

const AI_SPAN_INPUT_JSON_MAX_DEFAULT_DEPTH = 3;
const AI_SPAN_OUTPUT_JSON_MAX_DEFAULT_DEPTH = 100;
const AI_SPAN_JSON_AUTO_COLLAPSE_LIMIT = 100_000;

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
  /** Renders the loading skeleton while the conversation is still fetching. */
  isLoading?: boolean;
  /** The span to show. May be undefined while loading. */
  node?: AITraceSpanNode;
  /** When provided, a close button is shown in the header. */
  onClose?: () => void;
  /** Scrolls the panel back to the top whenever this value changes. */
  scrollResetKey?: string;
}

export function ConversationSpanDetail({
  node,
  traceId,
  activeTab,
  onTabChange,
  onClose,
  avgDuration,
  embedded,
  isLoading,
  scrollResetKey,
}: ConversationSpanDetailProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const organization = useOrganization();

  useEffect(() => {
    scrollContainerRef.current?.scrollTo({top: 0});
  }, [scrollResetKey]);

  // Full attributes (tool inputs/results, the complete attribute list) aren't
  // returned by the conversation list endpoint, so they're fetched per span.
  const eapValue = node && isEAPSpanNode(node) ? node.value : null;
  const {
    data,
    isLoading: isAttributesLoading,
    isError,
  } = useTraceItemDetails({
    traceItemId: eapValue?.event_id ?? '',
    projectId: eapValue ? eapValue.project_id.toString() : '',
    traceId,
    traceItemType: TraceItemDataset.SPANS,
    referrer: 'api.explore.log-item-details',
    timestamp: eapValue?.start_timestamp,
    enabled: Boolean(eapValue),
  });
  if (isLoading || !node) {
    return <SpanDetailSkeleton embedded={embedded} />;
  }

  const attributes = data?.attributes;

  const title = node.op || node.description || t('Span');
  const duration = getNodeTimeBounds(node).duration;
  const comparison = getDurationComparison(
    avgDuration,
    duration,
    t('Average duration for this span over the last 24 hours')
  );

  return (
    <SpanDetailCard ref={scrollContainerRef} embedded={embedded}>
      <Flex align="center" gap="lg" flexShrink={0}>
        <Flex flex="1" minWidth="0" align="center" gap="md">
          <AiSpanStatusIcon node={node} />
          <InfoText title={title} mode="overflowOnly" size="lg" bold>
            {title}
          </InfoText>
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

      <Stack gap="lg" flexShrink={0}>
        <Flex align="center" gap="sm" wrap="wrap">
          <Text size="lg">{getDuration(duration, 2, true, true)}</Text>
          {duration > 0 &&
          comparison &&
          comparison.deltaPct >= MIN_PCT_DURATION_DIFFERENCE ? (
            <Tag variant={comparison.variant}>{comparison.deltaText}</Tag>
          ) : null}
        </Flex>
        {isAttributesLoading ? (
          <SpanMetadataSkeleton />
        ) : (
          <SpanMetadata node={node} attributes={attributes} />
        )}
      </Stack>

      <StyledIssueList
        node={node}
        issues={node.uniqueIssues}
        organization={organization}
        traceSlug={traceId}
      />

      {/*
       * The per-span fetch backs both the metadata and the tab content, and it
       * isn't returned by the conversation list endpoint. Rather than let each
       * piece pop in on its own — which shifts the layout as the user clicks
       * between spans — show a skeleton until the fetch resolves, then reveal
       * the whole detail at once.
       */}
      {isAttributesLoading ? (
        <SpanTabsSkeleton />
      ) : isError ? (
        <EmptyTab message={t('Failed to load span details')} />
      ) : (
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
            flex="0 0 auto"
            minHeight="0"
            width="100%"
            overflowX="visible"
            overflowY="visible"
            // Gutter so the scroll container doesn't clip a focused input's focus ring.
            padding="xs"
          >
            <TabPanels
              css={css`
                padding-top: 0;
              `}
            >
              <TabPanels.Item key="input">
                <InputTab node={node} attributes={attributes} />
              </TabPanels.Item>
              <TabPanels.Item key="output">
                <OutputTab node={node} attributes={attributes} />
              </TabPanels.Item>
              <TabPanels.Item key="attributes">
                <AttributesTab node={node} attributes={attributes} />
              </TabPanels.Item>
            </TabPanels>
          </Container>
        </TabStateProvider>
      )}
    </SpanDetailCard>
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
    <Grid columns="max-content minmax(0, 1fr)" gap="lg" align="center">
      {rows.map(row => (
        <Fragment key={row.name}>
          <Text size="md" variant="muted">
            {row.name}
          </Text>
          <Container minWidth="0">
            {typeof row.value === 'string' ? (
              <Text size="md" as="div" ellipsis>
                {row.value}
              </Text>
            ) : (
              <Text size="md" as="div">
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
}: {
  attributes: SpanAttributes;
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
    return <EmptyTab message={t('No input for this span')} />;
  }

  return (
    <Fragment>
      {messages?.map((message, index) => (
        <Fragment key={index}>
          <TraceDrawerComponents.MultilineTextLabel>
            {capitalize(message.role)}
          </TraceDrawerComponents.MultilineTextLabel>
          {/* System prompts are usually long, repetitive, and sit on top, so keep them clipped */}
          <InputMessageContent
            key={`${node.id}:message:${index}`}
            content={message.content}
            clip={message.role === 'system'}
          />
        </Fragment>
      ))}
      {toolArgs ? (
        <TraceDrawerComponents.MultilineJSON
          key={`${node.id}:tool-input`}
          value={toolArgs}
          maxDefaultDepth={AI_SPAN_INPUT_JSON_MAX_DEFAULT_DEPTH}
          autoCollapseLimit={AI_SPAN_JSON_AUTO_COLLAPSE_LIMIT}
        />
      ) : null}
      {embeddingsInput ? (
        <TraceDrawerComponents.MultilineText clip={false}>
          {embeddingsInput.toString()}
        </TraceDrawerComponents.MultilineText>
      ) : null}
    </Fragment>
  );
}

function OutputTab({
  node,
  attributes,
}: {
  attributes: SpanAttributes;
  node: AITraceSpanNode;
}) {
  const {responseText, responseObject, toolCalls} = getAIOutputData(node, attributes);
  const toolOutput = getAIToolOutput(node, attributes);

  if (!responseText && !responseObject && !toolCalls && !toolOutput) {
    return <EmptyTab message={t('No output for this span')} />;
  }

  return (
    <Fragment>
      {responseText ? (
        <Fragment>
          <TraceDrawerComponents.MultilineTextLabel>
            {t('Response')}
          </TraceDrawerComponents.MultilineTextLabel>
          <AIContentRenderer
            key={`${node.id}:response-text`}
            text={responseText}
            maxJsonDepth={AI_SPAN_OUTPUT_JSON_MAX_DEFAULT_DEPTH}
            autoCollapseLimit={AI_SPAN_JSON_AUTO_COLLAPSE_LIMIT}
            clip={false}
          />
        </Fragment>
      ) : null}
      {responseObject ? (
        <Fragment>
          <TraceDrawerComponents.MultilineTextLabel>
            {t('Response Object')}
          </TraceDrawerComponents.MultilineTextLabel>
          <AIContentRenderer
            key={`${node.id}:response-object`}
            text={responseObject}
            maxJsonDepth={AI_SPAN_OUTPUT_JSON_MAX_DEFAULT_DEPTH}
            autoCollapseLimit={AI_SPAN_JSON_AUTO_COLLAPSE_LIMIT}
            clip={false}
          />
        </Fragment>
      ) : null}
      {toolCalls ? (
        <Fragment>
          <TraceDrawerComponents.MultilineTextLabel>
            {t('Tool Calls')}
          </TraceDrawerComponents.MultilineTextLabel>
          <TraceDrawerComponents.MultilineJSON
            key={`${node.id}:tool-calls`}
            value={toolCalls}
            maxDefaultDepth={AI_SPAN_OUTPUT_JSON_MAX_DEFAULT_DEPTH}
            autoCollapseLimit={AI_SPAN_JSON_AUTO_COLLAPSE_LIMIT}
          />
        </Fragment>
      ) : null}
      {toolOutput ? (
        <TraceDrawerComponents.MultilineJSON
          key={`${node.id}:tool-output`}
          value={toolOutput}
          maxDefaultDepth={AI_SPAN_OUTPUT_JSON_MAX_DEFAULT_DEPTH}
          autoCollapseLimit={AI_SPAN_JSON_AUTO_COLLAPSE_LIMIT}
        />
      ) : null}
    </Fragment>
  );
}

function InputMessageContent({
  content,
  clip = false,
}: {
  content: unknown;
  clip?: boolean;
}) {
  return typeof content === 'string' ? (
    <AIContentRenderer
      text={content}
      maxJsonDepth={AI_SPAN_INPUT_JSON_MAX_DEFAULT_DEPTH}
      autoCollapseLimit={AI_SPAN_JSON_AUTO_COLLAPSE_LIMIT}
      clip={clip}
    />
  ) : (
    <TraceDrawerComponents.MultilineJSON
      value={content}
      maxDefaultDepth={AI_SPAN_INPUT_JSON_MAX_DEFAULT_DEPTH}
      autoCollapseLimit={AI_SPAN_JSON_AUTO_COLLAPSE_LIMIT}
      clip={clip}
    />
  );
}

function AttributesTab({
  node,
  attributes,
}: {
  attributes: SpanAttributes;
  node: AITraceSpanNode;
}) {
  const theme = useTheme();
  const location = useLocation();
  const organization = useOrganization();
  const projectSlug = node.projectSlug;
  const {projects} = useProjects({slugs: projectSlug ? [projectSlug] : []});
  const project = projectSlug ? projects.find(p => p.slug === projectSlug) : undefined;

  if (!isEAPSpanNode(node) || !attributes) {
    return <EmptyTab message={t('No attributes for this span')} />;
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

// IssueList colors its severity icons from the trace grid CSS variables, which
// the trace waterfall normally provides via an ancestor. This panel isn't nested
// under the waterfall, so scope those variables here.
const StyledIssueList = styled(IssueList)`
  ${traceGridCssVariables}
  flex-shrink: 0;
`;

function EmptyTab({message}: {message: string}) {
  return (
    <Flex flex="1" background="secondary" radius="md" padding="xl">
      <Text variant="muted">{message}</Text>
    </Flex>
  );
}

function SpanDetailSkeleton({embedded}: {embedded?: boolean}) {
  return (
    <SpanDetailCard embedded={embedded}>
      <Flex align="center" gap="lg" flexShrink={0}>
        <Placeholder height="16px" width="16px" />
        <Placeholder height="16px" width="180px" />
      </Flex>
      <Stack gap="md" flexShrink={0}>
        <Placeholder height="16px" width="60px" />
        <SpanMetadataSkeleton />
      </Stack>
      <SpanTabsSkeleton />
    </SpanDetailCard>
  );
}

function SpanMetadataSkeleton() {
  return (
    <Grid columns="max-content minmax(0, 1fr)" gap="md lg" align="center">
      <Placeholder height="14px" width="80px" />
      <Placeholder height="14px" width="200px" />
      <Placeholder height="14px" width="60px" />
      <Placeholder height="14px" width="160px" />
    </Grid>
  );
}

function SpanTabsSkeleton() {
  return (
    <Fragment>
      <Flex gap="lg" flexShrink={0}>
        <Placeholder height="16px" width="44px" />
        <Placeholder height="16px" width="56px" />
        <Placeholder height="16px" width="96px" />
      </Flex>
      <Placeholder height="240px" width="100%" />
    </Fragment>
  );
}
