import {Fragment, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {IconChat} from '@sentry/icons/chat';
import {IconClose} from '@sentry/icons/close';
import {IconEllipsis} from '@sentry/icons/ellipsis';
import {IconSeer} from '@sentry/icons/seer';
import {useQuery, useQueryClient} from '@tanstack/react-query';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {Disclosure} from '@sentry/scraps/disclosure';
import {DropdownMenu, type MenuItemProps} from '@sentry/scraps/dropdownMenu';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {type MarkdownProps, type MarkdownTableColumn} from '@sentry/scraps/markdown';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Heading, Text} from '@sentry/scraps/text';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {openConfirmModal} from 'sentry/components/confirm';
import {Duration} from 'sentry/components/duration';
import {SeerMarkdown} from 'sentry/components/seer/markdown';
import {ChartContent} from 'sentry/components/seer/markdown/embeds/components/chart';
import {SeerEmbedBlock} from 'sentry/components/seer/markdown/embeds/components/seerEmbedBlock';
import {ALL_SEER_EMBED_SCHEMAS} from 'sentry/components/seer/markdown/embeds/schemas';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {COLUMN_ALIGN_JUSTIFY} from 'sentry/components/tables/sortableHeaderCell';
import {t, tn} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  getInvestigationDetailQueryOptions,
  investigationExecutionDetailQueryOptions,
  useDeleteInvestigationBlockMutation,
  useResumeInvestigationExecutionMutation,
  useStopInvestigationExecutionMutation,
} from 'sentry/views/investigations/api';
import {InvestigationBlockPlaceholder} from 'sentry/views/investigations/detail/blockPlaceholder';
import {
  getBlockLLMContext,
  getInvestigationReference,
  useInvestigationAskSeer,
} from 'sentry/views/investigations/investigationLLMContext';
import type {
  InvestigationBlock,
  InvestigationBlockKind,
  InvestigationDetail,
  InvestigationExecutionDetail,
  InvestigationExecutionStatus,
  InvestigationQueryOutput,
  InvestigationTranscriptBlock,
} from 'sentry/views/investigations/types';
import {visibleCallRecords} from 'sentry/views/seerExplorer/callRecords';
import {AskUserQuestionBlock} from 'sentry/views/seerExplorer/components/askUserQuestionBlock';
import {BlockComponent} from 'sentry/views/seerExplorer/components/chat';
import {MessagePlaceholder} from 'sentry/views/seerExplorer/components/chat/shared';
import {useLLMContext} from 'sentry/views/seerExplorer/contexts/llmContext';
import {registerLLMContext} from 'sentry/views/seerExplorer/contexts/registerLLMContext';
import {usePendingUserInput} from 'sentry/views/seerExplorer/hooks/usePendingUserInput';
import type {Block} from 'sentry/views/seerExplorer/types';

type InvestigationNotebookBlockProps = {
  block: InvestigationBlock;
  canRun: boolean;
  investigation: InvestigationDetail;
  commentCount?: number;
  onComment?: (blockId: string) => void;
};

function InvestigationNotebookBlockInner({
  block,
  canRun,
  investigation,
  commentCount = 0,
  onComment,
}: InvestigationNotebookBlockProps) {
  const organizationSlug = useOrganization().slug;
  const activeExecutionId = isExecutionActive(block.currentExecution?.status)
    ? (block.currentExecution?.id ?? null)
    : null;
  const autoOpenedExecutionId = useRef(activeExecutionId);
  const awaitingInput = block.currentExecution?.status === 'awaiting_input';
  // A block that has nothing in it yet is showing a placeholder, so opening the
  // Seer panel over it would bury that. A block waiting on an answer is the
  // exception — the question lives in the panel. Runs that start while the
  // page is open still open it, through the effects below.
  const [panelOpen, setPanelOpen] = useState(
    Boolean(activeExecutionId) && (hasRenderableContent(block) || awaitingInput)
  );
  const askedForInputId = useRef(awaitingInput ? activeExecutionId : null);
  const [traceExecutionId, setTraceExecutionId] = useState<string | null>(
    activeExecutionId
  );
  // Push the block into the LLM context tree for Seer Explorer. The same object
  // is the context when "Ask Seer" asks about this block.
  const blockLLMContext = getBlockLLMContext(block);
  useLLMContext(blockLLMContext);
  const askSeer = useInvestigationAskSeer();
  const progressState = getBlockProgressState(block, investigation.blocks ?? []);
  const executionId = block.currentExecution?.id;
  const streamedTextQuery = useQuery({
    ...investigationExecutionDetailQueryOptions({
      organizationSlug,
      investigationId: investigation.id,
      blockId: block.id,
      executionId: executionId ?? 'disabled',
    }),
    enabled:
      block.kind === 'text' &&
      Boolean(executionId) &&
      isExecutionActive(block.currentExecution?.status),
    refetchInterval: query =>
      isExecutionActive(query.state.data?.json.status) ? 500 : false,
  });

  const displayTitle = getBlockDisplayTitle(block);
  const deleteMutation = useDeleteInvestigationBlockMutation(
    organizationSlug,
    investigation.id,
    {onError: () => addErrorMessage(t('Unable to delete this block.'))}
  );

  useEffect(() => {
    if (!activeExecutionId || autoOpenedExecutionId.current === activeExecutionId) {
      return;
    }
    autoOpenedExecutionId.current = activeExecutionId;
    // eslint-disable react-you-might-not-need-an-effect/no-derived-state
    setPanelOpen(true);
    setTraceExecutionId(activeExecutionId);
    // eslint-enable react-you-might-not-need-an-effect/no-derived-state
  }, [activeExecutionId]);

  // A block that was already on screen can stop for a question part way through
  // its run. The execution is the same one, so the effect above stays quiet and
  // the question would sit unseen behind the placeholder. Opens once per
  // execution, so closing the panel keeps it closed.
  useEffect(() => {
    if (!awaitingInput || !activeExecutionId) {
      return;
    }
    if (askedForInputId.current === activeExecutionId) {
      return;
    }
    askedForInputId.current = activeExecutionId;
    // eslint-disable react-you-might-not-need-an-effect/no-derived-state
    setPanelOpen(true);
    setTraceExecutionId(activeExecutionId);
    // eslint-enable react-you-might-not-need-an-effect/no-derived-state
  }, [awaitingInput, activeExecutionId]);

  const handleAskSeer = askSeer
    ? () =>
        askSeer({
          prompt: block.title
            ? t('How do you want to steer the investigation: "%s"?', block.title)
            : t('How do you want to steer this block?'),
          context: {
            investigation: getInvestigationReference(investigation),
            block: blockLLMContext,
          },
        })
    : undefined;

  const actionItems: MenuItemProps[] = [
    {
      key: 'comment',
      label: t('Comment'),
      hidden: !onComment,
      onAction: () => onComment?.(block.id),
    },
    {
      key: 'ask-seer',
      label: t('Ask Seer'),
      hidden: !handleAskSeer,
      onAction: handleAskSeer,
    },
    {
      // Closing the panel of a run still going would otherwise leave no way back
      // to it, or to a question Seer is waiting on.
      key: 'show-activity',
      label: t('Show Seer activity'),
      hidden: !activeExecutionId || panelOpen,
      onAction: () => {
        setPanelOpen(true);
        setTraceExecutionId(activeExecutionId);
      },
    },
    {
      key: 'delete',
      label: t('Delete'),
      priority: 'danger',
      disabled:
        !canRun ||
        deleteMutation.isPending ||
        isExecutionActive(block.currentExecution?.status),
      onAction: () =>
        openConfirmModal({
          message: t('Are you sure you want to delete this block?'),
          priority: 'danger',
          confirmText: t('Delete'),
          onConfirm: () =>
            deleteMutation.mutate({
              block,
              investigationVersion: investigation.version,
            }),
        }),
    },
  ];

  const actionButtonProps = {
    actionItems,
    commentCount,
    displayTitle,
    onComment: onComment ? () => onComment(block.id) : undefined,
  };

  const panel =
    panelOpen && traceExecutionId ? (
      <AgentActivityPanel
        block={block}
        executionId={traceExecutionId}
        investigation={investigation}
        onAskSeer={handleAskSeer}
        onClose={() => setPanelOpen(false)}
      />
    ) : null;

  return (
    <Stack
      as="section"
      id={getBlockElementId(block.id)}
      width="100%"
      padding="0"
      data-test-id={`investigation-block-${block.id}`}
    >
      {block.kind === 'query' ? (
        <Fragment>
          <QueryResult
            actions={<BlockActionButtons {...actionButtonProps} size="zero" />}
            block={block}
            progressState={progressState}
          />
          {panel}
        </Fragment>
      ) : (
        <Fragment>
          <BlockResult
            block={block}
            actions={<BlockActionButtons {...actionButtonProps} size="xs" />}
            headerActions={<BlockActionButtons {...actionButtonProps} size="zero" />}
            progressState={progressState}
            streamedMarkdown={
              isExecutionActive(block.currentExecution?.status)
                ? streamedTextQuery.data?.partialMarkdown
                : null
            }
          />
          {panel}
        </Fragment>
      )}
    </Stack>
  );
}

export const InvestigationNotebookBlock = registerLLMContext(
  'investigation-block',
  InvestigationNotebookBlockInner
);

function BlockActionButtons({
  actionItems,
  commentCount,
  displayTitle,
  onComment,
  size,
}: {
  actionItems: MenuItemProps[];
  commentCount: number;
  displayTitle: string;
  /**
   * `zero` keeps a card's header band its usual height; `xs` sits beside a
   * text block's first line.
   */
  size: 'zero' | 'xs';
  onComment?: () => void;
}) {
  const hasComments = commentCount > 0;
  return (
    <Flex align="center" gap="2xs" flexShrink={0}>
      <BlockActions>
        <DropdownMenu
          position="bottom-end"
          usePortal
          trigger={triggerProps => (
            <OverlayTrigger.IconButton
              {...triggerProps}
              size={size}
              variant="transparent"
              icon={<IconEllipsis size="xs" />}
              aria-label={t('Block actions for %s', displayTitle)}
            />
          )}
          items={actionItems}
        />
      </BlockActions>
      {onComment ? (
        <BlockActions data-pinned={hasComments || undefined}>
          <Button
            size={size}
            variant="transparent"
            icon={<IconChat size="xs" variant={hasComments ? 'accent' : undefined} />}
            aria-label={
              hasComments
                ? tn('%s comment on %s', '%s comments on %s', commentCount, displayTitle)
                : t('Comment on %s', displayTitle)
            }
            data-block-comments-trigger
            tooltipProps={{
              title: hasComments ? t('View comments') : t('Add a comment'),
            }}
            onClick={onComment}
          />
        </BlockActions>
      ) : null}
    </Flex>
  );
}

function BlockResult({
  actions,
  block,
  headerActions,
  progressState,
  streamedMarkdown,
}: {
  actions: React.ReactNode;
  block: InvestigationBlock;
  /** The same actions, sized for the header of an embed the markdown opens with. */
  headerActions: React.ReactNode;
  progressState: BlockProgressState;
  streamedMarkdown?: string | null;
}) {
  const markdown = streamedMarkdown ?? getTextBlockMarkdown(block);
  // An embed the markdown opens with takes the actions into its card's header,
  // so the card can run the block's full width. Until one claims them -- or if
  // that embed renders no card -- they sit beside the first line.
  const [actionsInEmbed, setActionsInEmbed] = useState(false);
  // Stable, so a re-render (each streamed chunk) doesn't release and reclaim them.
  const claimActions = useCallback(() => {
    setActionsInEmbed(true);
    return () => setActionsInEmbed(false);
  }, []);
  const actionsBesideFirstLine = actionsInEmbed ? null : (
    <Grid area="1 / 2">
      {/* A hidden line of text, so the actions sit on the content's first line. */}
      <Container area="1 / 1">
        <Text as="div" aria-hidden size="md" density="comfortable">
          {'​'}
        </Text>
      </Container>
      <Flex area="1 / 1" height="0" alignSelf="center" align="center">
        {actions}
      </Flex>
    </Grid>
  );
  return (
    <BlockHoverSurface
      flex={1}
      minWidth={0}
      gap="sm"
      data-test-id="text-block-result"
      data-block-variant="unbordered"
    >
      <BlockExecutionAlert block={block} />
      {markdown ? (
        <MarkdownRows
          columns={actionsInEmbed ? 'minmax(0, 1fr)' : 'minmax(0, 1fr) auto'}
          gap="lg sm"
          align="start"
        >
          <SeerMarkdown
            raw={markdown}
            components={TEXT_BLOCK_MARKDOWN_COMPONENTS}
            leadingEmbedActions={{actions: headerActions, onClaim: claimActions}}
          />
          {actionsBesideFirstLine}
        </MarkdownRows>
      ) : (
        <Grid columns="minmax(0, 1fr) auto" gap="sm" align="start">
          {isBlockWorking(block) ? (
            <Container paddingBottom="xl">
              <InvestigationBlockPlaceholder title={block.title} />
            </Container>
          ) : (
            <BlockProgress state={progressState} />
          )}
          {actionsBesideFirstLine}
        </Grid>
      )}
    </BlockHoverSurface>
  );
}

/**
 * Renders headings the way `SeerMarkdown` does, marked so the outline can find
 * the block's own headings apart from any inside its embeds.
 */
const TEXT_BLOCK_MARKDOWN_COMPONENTS: MarkdownProps['components'] = {
  Heading: ({children, level}) => (
    <Heading as={`h${level}`} size="lg" data-investigation-block-heading="">
      {children}
    </Heading>
  ),
};

function QueryResult({
  actions,
  block,
  progressState,
}: {
  actions: React.ReactNode;
  block: InvestigationBlock;
  progressState: BlockProgressState;
}) {
  const output = getQueryOutput(block.output);
  const chart =
    output?.preferredView === 'chart' ? getRenderableChart(output.chart) : null;
  const title = block.title || chart?.title || t('Untitled query');
  const chartHeaderTitle = getDisplayText(block.display, 'title') || chart?.title;
  const chartHeaderMetadata =
    getDisplayText(block.display, 'subtitle') ||
    chart?.subtitle ||
    getChartMetadata(chart);

  // The agent is told to write this as a bare Markdown table so it can run
  // edge to edge beneath the card's inset content, but it sometimes adds prose
  // around the table anyway, which `QueryResultMarkdown` insets.
  const tableMarkdown = chart ? null : output?.tableMarkdown || null;

  const header =
    (chartHeaderTitle && chartHeaderTitle !== title) || chartHeaderMetadata ? (
      <Stack gap="2xs" data-test-id="query-block-header">
        {chartHeaderTitle && chartHeaderTitle !== title ? (
          <Heading as="h3" size="md">
            {chartHeaderTitle}
          </Heading>
        ) : null}
        {chartHeaderMetadata ? (
          <Text size="sm" variant="muted">
            {chartHeaderMetadata}
          </Text>
        ) : null}
      </Stack>
    ) : null;
  const body = chart ? (
    <Container width="100%" overflow="hidden">
      <ChartContent data={chart} showHeader={false} />
    </Container>
  ) : tableMarkdown ? null : isBlockWorking(block) ? (
    // The result's own header lands here, not the block title the
    // card's header above already shows.
    <InvestigationBlockPlaceholder />
  ) : (
    <BlockProgress state={progressState} />
  );

  const hasInsetContent = Boolean(header || hasExecutionAlert(block) || body);

  return (
    <BlockHoverSurface width="100%">
      <SeerEmbedBlock
        actions={actions}
        gap="0"
        padding="0"
        testId="query-block"
        title={title}
      >
        {/* A table alone has nothing to inset above it; rendering the section
            anyway would leave its padding as an empty strip. */}
        {hasInsetContent ? (
          <Stack gap="md" padding="lg">
            {header}
            <BlockExecutionAlert block={block} />
            {body}
          </Stack>
        ) : null}
        {tableMarkdown ? (
          <QueryResultMarkdown insetTop={!hasInsetContent}>
            <SeerMarkdown raw={tableMarkdown} components={{Table: QueryResultTable}} />
          </QueryResultMarkdown>
        ) : null}
      </SeerEmbedBlock>
    </BlockHoverSurface>
  );
}

type BlockProgressState =
  | 'running'
  | 'waiting'
  | 'failed'
  | 'cancelled'
  | 'blockedByFailure'
  | 'blockedByCancellation'
  | null;

function hasExecutionAlert(block: InvestigationBlock): boolean {
  const status = block.currentExecution?.status;
  return status === 'failed' || status === 'cancelled';
}

function BlockExecutionAlert({block}: {block: InvestigationBlock}) {
  const execution = block.currentExecution;
  if (!execution || !hasExecutionAlert(block)) {
    return null;
  }
  const failed = execution.status === 'failed';
  return (
    <Alert.Container data-test-id={`block-execution-${execution.status}`}>
      <Alert variant={failed ? 'danger' : 'warning'}>
        {execution.error?.message ||
          (failed ? t('This Seer run failed.') : t('This Seer run was cancelled.'))}
      </Alert>
    </Alert.Container>
  );
}

function BlockProgress({state}: {state: BlockProgressState}) {
  if (!state) {
    return <Text variant="muted">{t('This block has no output yet.')}</Text>;
  }
  let message = t('Cancelled because a previous block failed.');
  if (state === 'running') {
    message = t('Seer is working on this block…');
  } else if (state === 'waiting') {
    message = t('Waiting for previous blocks…');
  } else if (state === 'failed') {
    message = t('This block failed to run.');
  } else if (state === 'cancelled') {
    message = t('This block run was cancelled.');
  } else if (state === 'blockedByCancellation') {
    message = t('Waiting because a previous block was cancelled.');
  }
  return (
    <Flex align="center" gap="xs" data-test-id={`block-progress-${state}`}>
      <IconSeer
        size="xs"
        animation={['running', 'waiting'].includes(state) ? 'idle' : undefined}
      />
      <Text variant="muted">{message}</Text>
    </Flex>
  );
}

function getBlockProgressState(
  block: InvestigationBlock,
  blocks: InvestigationBlock[]
): BlockProgressState {
  if (isExecutionActive(block.currentExecution?.status)) {
    return 'running';
  }
  if (block.currentExecution?.status === 'failed') {
    return 'failed';
  }
  if (block.currentExecution?.status === 'cancelled') {
    return 'cancelled';
  }
  if (
    block.currentExecution ||
    block.config.autoRun !== true ||
    block.dependencies.length === 0
  ) {
    return null;
  }
  if (hasFailedDependency(block, blocks)) {
    return 'blockedByFailure';
  }
  if (hasCancelledDependency(block, blocks)) {
    return 'blockedByCancellation';
  }
  return 'waiting';
}

export function shouldDisplayInvestigationBlock(block: InvestigationBlock) {
  // Seer names a block before it fills it, so a block it has started can be shown
  // right away. A block that is only queued stays hidden — it may never produce
  // anything.
  if (isBlockWorking(block) && block.title.trim()) {
    return true;
  }
  if (block.kind === 'text') {
    return Boolean((getTextOutput(block.output) ?? block.content).trim());
  }
  const output = getQueryOutput(block.output);
  if (!output || output.isEmpty) {
    return false;
  }
  return Boolean(
    output.tableMarkdown.trim() ||
    (output.preferredView === 'chart' && getRenderableChart(output.chart))
  );
}

export function shouldPollInvestigationBlocks(blocks: InvestigationBlock[]) {
  return blocks.some(
    block =>
      isExecutionActive(block.outputStatus) ||
      getBlockProgressState(block, blocks) === 'waiting'
  );
}

function isInvestigationFailureExecution(
  execution: InvestigationBlock['currentExecution']
) {
  return (
    execution?.status === 'failed' ||
    (execution?.status === 'cancelled' &&
      execution.error?.code === 'investigation_execution_failed')
  );
}

function hasFailedDependency(
  block: InvestigationBlock,
  blocks: InvestigationBlock[],
  visited = new Set<string>()
): boolean {
  for (const dependencyId of block.dependencies) {
    if (visited.has(dependencyId)) {
      continue;
    }
    visited.add(dependencyId);
    const dependency = blocks.find(candidate => candidate.id === dependencyId);
    if (!dependency) {
      continue;
    }
    if (isInvestigationFailureExecution(dependency.currentExecution)) {
      return true;
    }
    if (hasFailedDependency(dependency, blocks, visited)) {
      return true;
    }
  }
  return false;
}

function hasCancelledDependency(
  block: InvestigationBlock,
  blocks: InvestigationBlock[],
  visited = new Set<string>()
): boolean {
  for (const dependencyId of block.dependencies) {
    if (visited.has(dependencyId)) {
      continue;
    }
    visited.add(dependencyId);
    const dependency = blocks.find(candidate => candidate.id === dependencyId);
    if (!dependency) {
      continue;
    }
    if (dependency.currentExecution?.status === 'cancelled') {
      return true;
    }
    if (hasCancelledDependency(dependency, blocks, visited)) {
      return true;
    }
  }
  return false;
}
/**
 * A query's results arrive as a Markdown table but render through
 * `SimpleTable`, the same table the query embeds use, so the two can't drift
 * apart.
 */
function QueryResultTable({
  columns,
  header,
  rows,
}: {
  columns: MarkdownTableColumn[];
  header: React.ReactNode[];
  rows: React.ReactNode[][];
}) {
  return (
    <FlushSimpleTable
      data-query-result-table
      // The same split the query embeds' tables use: the leading column tends
      // to name the row, and the rest hold its values.
      columns={columns.map((_, index) => ({
        key: String(index),
        width: index === 0 ? 'minmax(0, 2fr)' : 'minmax(0, 1fr)',
      }))}
      header={
        <QueryResultHeaderRow>
          {header.map((cell, index) => (
            <SimpleTable.HeaderCell key={index} align={columns[index]?.align}>
              {cell}
            </SimpleTable.HeaderCell>
          ))}
        </QueryResultHeaderRow>
      }
    >
      {rows.map((row, rowIndex) => (
        <SimpleTable.Row key={rowIndex}>
          {row.map((cell, cellIndex) => (
            <SimpleTable.RowCell
              key={cellIndex}
              justify={COLUMN_ALIGN_JUSTIFY[columns[cellIndex]?.align ?? 'left']}
            >
              {cell}
            </SimpleTable.RowCell>
          ))}
        </SimpleTable.Row>
      ))}
    </FlushSimpleTable>
  );
}

type AgentActivityPanelProps = {
  block: InvestigationBlock;
  executionId: string;
  investigation: InvestigationDetail;
  onClose: () => void;
  onAskSeer?: () => void;
};

/**
 * What Seer did on one run of a block: its transcript, any question it is
 * waiting on, and a way to stop it.
 */
function AgentActivityPanel({
  block,
  executionId,
  investigation,
  onAskSeer,
  onClose,
}: AgentActivityPanelProps) {
  const organizationSlug = useOrganization().slug;
  const queryClient = useQueryClient();
  const stopMutation = useStopInvestigationExecutionMutation(
    organizationSlug,
    investigation.id,
    {
      onError: () => addErrorMessage(t('Unable to stop this Seer run.')),
    }
  );
  const resumeMutation = useResumeInvestigationExecutionMutation(
    organizationSlug,
    investigation.id,
    {onError: () => addErrorMessage(t('Unable to resume this Seer run.'))}
  );
  const executionQuery = useQuery({
    ...investigationExecutionDetailQueryOptions({
      organizationSlug,
      investigationId: investigation.id,
      blockId: block.id,
      executionId,
    }),
    refetchInterval: query =>
      isExecutionActive(query.state.data?.json.status) ? 1000 : false,
  });
  const execution = executionQuery.data;
  const currentExecution =
    block.currentExecution?.id === executionId ? block.currentExecution : null;
  const status = execution?.status ?? currentExecution?.status;
  const active = isExecutionActive(status);
  const elapsed = useElapsedTime(
    currentExecution?.startedAt ?? execution?.blocks[0]?.timestamp ?? null,
    currentExecution?.completedAt ?? null,
    active
  );

  useEffect(() => {
    if (status && !isExecutionActive(status) && status !== 'notRun') {
      void queryClient.invalidateQueries({
        queryKey: getInvestigationDetailQueryOptions(organizationSlug, investigation.id)
          .queryKey,
      });
    }
  }, [investigation.id, organizationSlug, queryClient, status]);

  return (
    <AgentActivityDisclosure defaultExpanded size="sm">
      <AgentActivityDisclosureTitle
        leadingItems={<IconSeer size="xs" animation={active ? 'idle' : undefined} />}
        trailingItems={
          <Flex align="center" gap="sm">
            {elapsed === null ? null : <ElapsedDuration milliseconds={elapsed} />}
            <Button
              size="xs"
              variant="transparent"
              icon={<IconClose size="xs" />}
              aria-label={t('Close Seer panel')}
              onClick={onClose}
            />
          </Flex>
        }
      >
        <AgentActivityTitle monospace>{getExecutionTitle(status)}</AgentActivityTitle>
      </AgentActivityDisclosureTitle>
      <AgentActivityDisclosureContent>
        <Stack gap="md">
          <Transcript
            blockKind={block.kind}
            blocks={execution?.blocks ?? []}
            completedAt={currentExecution?.completedAt ?? null}
            active={active}
          />
          {execution?.pendingUserInput ? (
            <PendingInvestigationQuestion
              pendingInput={execution.pendingUserInput}
              responding={resumeMutation.isPending}
              onRespond={(inputId, responseData) =>
                resumeMutation.mutate({
                  blockId: block.id,
                  executionId,
                  inputId,
                  responseData,
                })
              }
            />
          ) : null}
          {execution?.transcriptTruncated ? (
            <Text size="sm" variant="muted">
              {t('Earlier steps are not shown.')}
            </Text>
          ) : null}
          {status === 'failed' || status === 'cancelled' ? (
            <Alert.Container>
              <Alert variant={status === 'failed' ? 'danger' : 'warning'}>
                {status === 'failed'
                  ? execution?.error?.message ||
                    currentExecution?.error?.message ||
                    t('This Seer run failed.')
                  : t('This Seer run was cancelled.')}
              </Alert>
            </Alert.Container>
          ) : null}
          <Flex align="center" gap="sm">
            {active ? (
              <Button
                size="sm"
                busy={stopMutation.isPending}
                onClick={() => stopMutation.mutate({blockId: block.id, executionId})}
              >
                {t('Stop')}
              </Button>
            ) : null}
            {status && !active && onAskSeer ? (
              <Button size="sm" variant="primary" onClick={onAskSeer}>
                {t('Ask Seer')}
              </Button>
            ) : null}
          </Flex>
        </Stack>
      </AgentActivityDisclosureContent>
    </AgentActivityDisclosure>
  );
}

function PendingInvestigationQuestion({
  onRespond,
  pendingInput,
  responding,
}: {
  onRespond: (inputId: string, responseData: {answers: string[]}) => void;
  pendingInput: NonNullable<InvestigationExecutionDetail['pendingUserInput']>;
  responding: boolean;
}) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const userScrolledUpRef = useRef(false);
  const {
    canSubmitQuestion,
    currentQuestion,
    customText,
    handleQuestionBack,
    handleQuestionCustomTextChange,
    handleQuestionNext,
    handleQuestionSelectOption,
    isOtherSelected,
    questionIndex,
    selectedOption,
    totalQuestions,
  } = usePendingUserInput({
    isAwaitingUserInput: true,
    pendingInput,
    respondToUserInput: (inputId, responseData) => {
      if (responseData && 'answers' in responseData) {
        onRespond(inputId, responseData);
      }
    },
    scrollContainerRef,
    userScrolledUpRef,
  });

  if (!currentQuestion) {
    return null;
  }

  return (
    <Stack ref={scrollContainerRef} gap="sm" data-test-id="investigation-question">
      <AskUserQuestionBlock
        currentQuestion={currentQuestion}
        customText={customText}
        isOtherSelected={isOtherSelected}
        onCustomTextChange={handleQuestionCustomTextChange}
        onSelectOption={handleQuestionSelectOption}
        questionIndex={questionIndex}
        selectedOption={selectedOption}
      />
      <Flex align="center" justify="end" gap="sm">
        {questionIndex > 0 ? (
          <Button size="sm" onClick={handleQuestionBack} disabled={responding}>
            {t('Back')}
          </Button>
        ) : null}
        <Button
          size="sm"
          variant="primary"
          busy={responding}
          disabled={!canSubmitQuestion}
          onClick={handleQuestionNext}
        >
          {questionIndex + 1 === totalQuestions ? t('Submit') : t('Next')}
        </Button>
      </Flex>
    </Stack>
  );
}

function Transcript({
  active,
  blockKind,
  blocks,
  completedAt,
}: {
  active: boolean;
  blockKind: InvestigationBlockKind;
  blocks: InvestigationTranscriptBlock[];
  completedAt: string | null;
}) {
  const now = useNow(active);
  const visibleBlocks = useMemo(
    () =>
      blocks.filter((block, index) =>
        isRenderableTranscriptBlock(block, index, blockKind)
      ),
    [blocks, blockKind]
  );
  const explorerBlocks = useMemo(
    () => visibleBlocks.map(adaptTranscriptBlock),
    [visibleBlocks]
  );

  if (visibleBlocks.length === 0) {
    return <Text variant="muted">{active ? t('Starting Seer…') : t('No steps')}</Text>;
  }

  return (
    <TraceSurface
      gap="md"
      padding="md"
      background="secondary"
      radius="lg"
      data-test-id="investigation-transcript"
    >
      {explorerBlocks.map((block, index) => {
        const currentVisibleBlock = visibleBlocks[index];
        if (!currentVisibleBlock) {
          return null;
        }
        const end =
          visibleBlocks[index + 1]?.timestamp ?? completedAt ?? (active ? now : null);
        const duration = getElapsedMilliseconds(block.timestamp, end);
        // Still streaming in: the raw JSON is unreadable as prose, so this row is rendered as a
        // plain loading placeholder instead of routing it through `BlockComponent`, which would
        // otherwise show it as assistant markdown. `isRenderableTranscriptBlock` drops the row
        // outright once the object is complete, since `QueryResult` above already renders it.
        const isBuildingChart =
          currentVisibleBlock.loading &&
          isStructuredQueryResultBlock(currentVisibleBlock, blockKind);
        return (
          <Grid key={block.id} columns="minmax(0, 1fr) auto" align="start" gap="md">
            {isBuildingChart ? (
              <MessagePlaceholder content={t('Building chart…')} />
            ) : (
              <BlockComponent
                block={block}
                blockIndex={index}
                blocks={explorerBlocks}
                readOnly
                showThinking
              />
            )}
            {duration === null ? null : <ElapsedDuration milliseconds={duration} />}
          </Grid>
        );
      })}
    </TraceSurface>
  );
}

function isInternalPromptBlock(block: InvestigationTranscriptBlock, index: number) {
  return (
    index === 0 &&
    block.message.role === 'user' &&
    typeof block.message.content === 'string' &&
    block.message.content.includes('<investigation_context>')
  );
}

/**
 * A query block's final answer is always a single raw JSON object (see `QUERY_INSTRUCTIONS` in
 * `agent.py`), never prose meant to be read as-is — `QueryResult` above already renders its
 * parsed chart or table. Detected by role and a `{` prefix so a legitimate inline clarification
 * question (plain markdown, never JSON) still renders normally.
 */
function isStructuredQueryResultBlock(
  block: InvestigationTranscriptBlock,
  blockKind: InvestigationBlockKind
): boolean {
  return (
    blockKind === 'query' &&
    block.message.role === 'assistant' &&
    Boolean(block.message.content?.trim().startsWith('{'))
  );
}

function isRenderableTranscriptBlock(
  block: InvestigationTranscriptBlock,
  index: number,
  blockKind: InvestigationBlockKind
) {
  if (isInternalPromptBlock(block, index)) {
    return false;
  }
  // Once it has finished streaming, this is the redundant raw JSON dump described above — the
  // rendered chart/table already stands in for it, so the row is dropped rather than shown.
  if (!block.loading && isStructuredQueryResultBlock(block, blockKind)) {
    return false;
  }
  if (block.loading || block.message.content?.trim()) {
    return true;
  }
  if (block.message.role !== 'tool_use') {
    return false;
  }
  if (block.message.thinking_content?.trim() || block.toolLinks?.some(Boolean)) {
    return true;
  }

  const codeModeFunctions = new Set(['sentry_api_execute', 'sentry_api_search']);
  if (block.message.tool_calls?.some(call => !codeModeFunctions.has(call.function))) {
    return true;
  }

  return Boolean(
    block.toolResults?.some(result => {
      const structuredContent = result?.structuredContent;
      if (!structuredContent) {
        return false;
      }
      const calls = structuredContent.calls ?? [];
      return (
        visibleCallRecords(calls).length > 0 ||
        (Array.isArray(structuredContent.links) && structuredContent.links.length > 0) ||
        (Array.isArray(structuredContent.todos) && structuredContent.todos.length > 0) ||
        result.content.trimStart().startsWith('{%')
      );
    })
  );
}

function adaptTranscriptBlock(block: InvestigationTranscriptBlock): Block {
  return {
    id: block.id,
    timestamp: block.timestamp,
    loading: block.loading,
    message: block.message,
    artifacts: block.artifacts,
    tool_links: block.toolLinks,
    tool_results: block.toolResults,
  };
}

function useElapsedTime(start: string | null, end: string | null, active: boolean) {
  const now = useNow(active);
  return getElapsedMilliseconds(start, end ?? (active ? now : null));
}

function useNow(active: boolean) {
  const [now, setNow] = useState(() => new Date().toISOString());
  useEffect(() => {
    if (!active) {
      return;
    }
    const interval = window.setInterval(() => setNow(new Date().toISOString()), 250);
    return () => window.clearInterval(interval);
  }, [active]);
  return now;
}

function getElapsedMilliseconds(start: string | null, end: string | null) {
  if (!start || !end) {
    return null;
  }
  const duration = Date.parse(end) - Date.parse(start);
  if (!Number.isFinite(duration) || duration < 0) {
    return null;
  }
  return duration;
}

function ElapsedDuration({milliseconds}: {milliseconds: number}) {
  return (
    <Text monospace variant="muted">
      <Duration seconds={milliseconds / 1000} fixedDigits={1} abbreviation />
    </Text>
  );
}

function getExecutionTitle(status: InvestigationExecutionStatus | undefined) {
  if (isExecutionActive(status)) {
    return t('Working on this analysis…');
  }
  if (status === 'failed') {
    return t('Seer run failed');
  }
  if (status === 'cancelled') {
    return t('Seer run cancelled');
  }
  return t('Analysis complete');
}

function hasRenderableContent(block: InvestigationBlock) {
  return Boolean(block.output) || Boolean(block.content.trim());
}

/**
 * Whether Seer has a run going for this block — queued, working, paused on a
 * question, or stopping. These are the four the server itself treats as live.
 *
 * `notRun` is the one unfinished state left out: nothing has been dispatched
 * for the block, and an auto-run block whose dependency failed never will be.
 */
export function isBlockWorking(block: InvestigationBlock) {
  return (
    isExecutionActive(block.outputStatus) ||
    isExecutionActive(block.currentExecution?.status)
  );
}

function isExecutionActive(status: InvestigationExecutionStatus | undefined) {
  return Boolean(
    status && ['pending', 'running', 'awaiting_input', 'stopping'].includes(status)
  );
}

function getTextOutput(output: unknown): string | null {
  if (!output || typeof output !== 'object') {
    return null;
  }
  return 'markdown' in output && typeof output.markdown === 'string'
    ? output.markdown
    : null;
}

type RenderableQueryOutput = Pick<
  InvestigationQueryOutput,
  'chart' | 'preferredView' | 'tableMarkdown' | 'isEmpty'
>;

export function getBlockElementId(blockId: string) {
  return `investigation-block-${blockId}`;
}

/**
 * The nth heading in a text block's own Markdown, leaving out any inside its
 * embeds.
 */
export function getBlockHeadingElement(blockId: string, index: number) {
  return (
    document
      .getElementById(getBlockElementId(blockId))
      ?.querySelectorAll<HTMLElement>('[data-investigation-block-heading]')[index] ?? null
  );
}

/**
 * What a text block shows once it has settled: its output, or the content a
 * person wrote.
 */
export function getTextBlockMarkdown(block: InvestigationBlock) {
  return getTextOutput(block.output) ?? (block.content.trim() || null);
}

export function getBlockDisplayTitle(block: InvestigationBlock) {
  const chartTitle =
    block.kind === 'query'
      ? getRenderableChart(getQueryOutput(block.output)?.chart ?? null)?.title
      : null;
  return (
    block.title ||
    chartTitle ||
    (block.kind === 'query' ? t('Untitled query') : t('Untitled block'))
  );
}

function getQueryOutput(output: unknown): RenderableQueryOutput | null {
  if (
    !output ||
    typeof output !== 'object' ||
    !('tableMarkdown' in output) ||
    typeof output.tableMarkdown !== 'string' ||
    !('preferredView' in output) ||
    (output.preferredView !== 'chart' && output.preferredView !== 'table')
  ) {
    return null;
  }
  const chart =
    'chart' in output && (output.chart === null || isRecord(output.chart))
      ? output.chart
      : null;
  return {
    chart,
    isEmpty: 'isEmpty' in output && output.isEmpty === true,
    preferredView: output.preferredView,
    tableMarkdown: output.tableMarkdown,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function getRenderableChart(chart: Record<string, unknown> | null) {
  if (!chart) {
    return null;
  }
  const {subtitle, ...chartWithoutSubtitle} = chart;
  const normalizedChart = subtitle === null ? chartWithoutSubtitle : chart;
  const parsed = ALL_SEER_EMBED_SCHEMAS.chart.schema.safeParse(normalizedChart);
  return parsed.success ? parsed.data : null;
}

function getDisplayText(display: Record<string, unknown>, field: string) {
  const value = display[field];
  return typeof value === 'string' && value.trim() ? value : null;
}

function getChartMetadata(chart: ReturnType<typeof getRenderableChart>) {
  if (!chart) {
    return null;
  }

  const values = chart.series.flatMap(series => series.data.map(point => point.y));
  const total = values.reduce((sum, value) => sum + value, 0);
  const firstSeries = chart.series[0];
  const seriesName = firstSeries ? getSeriesName(firstSeries) : null;
  const totalMetadata = Number.isFinite(total)
    ? seriesName
      ? t('%s total %s', new Intl.NumberFormat().format(total), seriesName)
      : t('%s total', new Intl.NumberFormat().format(total))
    : null;

  if (chart.x_axis !== 'time') {
    return totalMetadata;
  }

  const timestamps = chart.series
    .flatMap(series => series.data.map(point => Date.parse(String(point.x))))
    .filter(Number.isFinite);
  if (timestamps.length === 0) {
    return totalMetadata;
  }

  const formatter = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
  });
  const start = formatter.format(new Date(Math.min(...timestamps)));
  const end = formatter.format(new Date(Math.max(...timestamps)));
  const range = start === end ? start : `${start}–${end}`;
  return totalMetadata ? `${range} | ${totalMetadata}` : range;
}

function getSeriesName(series: {label: string} | {name: string}) {
  return 'label' in series ? series.label : series.name;
}

const BlockActions = styled(Flex)`
  opacity: 0;
  pointer-events: none;

  &[data-pinned] {
    opacity: 1;
    pointer-events: auto;
  }
`;

const BlockHoverSurface = styled(Stack)`
  &:hover ${BlockActions},
  &:focus-within ${BlockActions} {
    opacity: 1;
    pointer-events: auto;
  }

  @media (hover: none) {
    ${BlockActions} {
      opacity: 1;
      pointer-events: auto;
    }
  }
`;

/**
 * Lays `SeerMarkdown`'s top-level blocks out as rows of this grid, beside the
 * actions in the second column. The first block shares its row with them and
 * wraps short of them; every block after it runs the full width, so an embed
 * lines up with a query block's card wherever it sits, in a list included.
 */
const MarkdownRows = styled(Grid)`
  /* SeerMarkdown's root, which steps aside so its blocks are this grid's. */
  > :first-child {
    display: contents;
  }

  > :first-child > * {
    grid-column: 1 / -1;
    /* Spanning the actions column, a wide table or code block would widen it. */
    min-width: 0;
  }

  > :first-child > :first-child {
    grid-column: 1;
  }
`;

/**
 * The table runs edge to edge in the query card, whose own border already
 * frames it, so `SimpleTable`'s border and rounding would draw a second box
 * inside the first. Only the top rule stays, dividing the header from the
 * card's header band or the content inset above it, plus a bottom rule when
 * prose follows the table, since the card's border no longer closes it off.
 */
const FlushSimpleTable = styled(SimpleTable)`
  border-width: 1px 0 0;
  border-radius: 0;

  &:not(:last-child) {
    border-bottom-width: 1px;
  }
`;

/**
 * Insets any prose the agent wrote around the table to line up with the
 * card's header, while the table itself keeps running edge to edge. The
 * Markdown renders each block as a direct child of its own root.
 */
const QueryResultMarkdown = styled('div')<{insetTop: boolean}>`
  > * > :not([data-query-result-table]) {
    padding-inline: ${p => p.theme.space.lg};
  }

  > * > :first-child:not([data-query-result-table]) {
    padding-top: ${p => (p.insetTop ? p.theme.space.lg : 0)};
  }

  > * > :last-child:not([data-query-result-table]) {
    padding-bottom: ${p => p.theme.space.lg};
  }
`;

/**
 * Square corners to sit flush with the table, and a slimmer row than
 * SimpleTable's own header, per the query card design.
 */
const QueryResultHeaderRow = styled(SimpleTable.HeaderRow)`
  border-radius: 0;
  min-height: ${p => p.theme.space['3xl']};
`;

const AgentActivityDisclosure = styled(Disclosure)`
  width: 100%;
  margin-top: ${p => p.theme.space.lg};

  & > div:first-child {
    padding-inline: ${p => p.theme.space['2xs']};
  }
`;

const AgentActivityDisclosureTitle = styled(Disclosure.Title)`
  padding-inline: 0;
`;

const AgentActivityTitle = styled(Text)`
  font-size: ${p => p.theme.font.size.sm};
  font-style: normal;
  font-weight: 700;
  line-height: ${p => p.theme.font.lineHeight.fixed};
  letter-spacing: 0;
  vertical-align: middle;
  font-variant-numeric: lining-nums tabular-nums;
`;

const AgentActivityDisclosureContent = styled(Disclosure.Content)`
  && {
    padding: ${p => p.theme.space.sm} 0 0;
  }
`;

const TraceSurface = styled(Stack)`
  &,
  & * {
    font-family: ${p => p.theme.font.family.mono};
  }
`;
