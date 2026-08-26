import {Fragment, useEffect, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {useQuery, useQueryClient} from '@tanstack/react-query';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {Disclosure} from '@sentry/scraps/disclosure';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';
import {TextArea} from '@sentry/scraps/textarea';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {openConfirmModal} from 'sentry/components/confirm';
import {DropdownMenu, type MenuItemProps} from 'sentry/components/dropdownMenu';
import {Duration} from 'sentry/components/duration';
import {SeerMarkdown} from 'sentry/components/seer/markdown';
import {ChartContent} from 'sentry/components/seer/markdown/embeds/components/chart';
import {ALL_SEER_EMBED_SCHEMAS} from 'sentry/components/seer/markdown/embeds/schemas';
import {
  IconArrow,
  IconChevron,
  IconClose,
  IconEllipsis,
  IconReturn,
  IconSeer,
} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  getInvestigationDetailQueryOptions,
  investigationExecutionDetailQueryOptions,
  useDeleteInvestigationBlockMutation,
  useResumeInvestigationExecutionMutation,
  useRunInvestigationBlockMutation,
  useStopInvestigationExecutionMutation,
  useUpdateInvestigationBlockPromptMutation,
} from 'sentry/views/investigations/api';
import type {
  InvestigationBlock,
  InvestigationDetail,
  InvestigationExecutionDetail,
  InvestigationExecutionStatus,
  InvestigationQueryOutput,
  InvestigationTranscriptBlock,
} from 'sentry/views/investigations/types';
import {visibleCallRecords} from 'sentry/views/seerExplorer/callRecords';
import {AskUserQuestionBlock} from 'sentry/views/seerExplorer/components/askUserQuestionBlock';
import {BlockComponent} from 'sentry/views/seerExplorer/components/chat';
import {usePendingUserInput} from 'sentry/views/seerExplorer/hooks/usePendingUserInput';
import type {Block} from 'sentry/views/seerExplorer/types';

type InvestigationCellProps = {
  block: InvestigationBlock;
  canRun: boolean;
  investigation: InvestigationDetail;
};

export function InvestigationCell({
  block,
  canRun,
  investigation,
}: InvestigationCellProps) {
  const organizationSlug = useOrganization().slug;
  const activeExecutionId = isExecutionActive(block.currentExecution?.status)
    ? (block.currentExecution?.id ?? null)
    : null;
  const autoOpenedExecutionId = useRef(activeExecutionId);
  const [panelOpen, setPanelOpen] = useState(Boolean(activeExecutionId));
  const [traceExecutionId, setTraceExecutionId] = useState<string | null>(
    activeExecutionId
  );
  const [showPrompt, setShowPrompt] = useState(!activeExecutionId);
  const [prompt, setPrompt] = useState(() =>
    block.outputStatus === 'notRun' ? block.generationPrompt : ''
  );
  const progressState = getCellProgressState(block, investigation.blocks ?? []);
  const waitingForDependencies =
    progressState === 'waiting' ||
    progressState === 'blockedByFailure' ||
    progressState === 'blockedByCancellation';
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

  const chartTitle =
    block.kind === 'query'
      ? getRenderableChart(getQueryOutput(block.output)?.chart ?? null)?.title
      : null;
  const displayTitle =
    block.title ||
    chartTitle ||
    (block.kind === 'query' ? t('Untitled query') : t('Untitled cell'));
  const rerunMutation = useRunInvestigationBlockMutation(
    organizationSlug,
    investigation.id,
    {onError: () => addErrorMessage(t('Unable to rerun this cell.'))}
  );
  const deleteMutation = useDeleteInvestigationBlockMutation(
    organizationSlug,
    investigation.id,
    {onError: () => addErrorMessage(t('Unable to delete this cell.'))}
  );

  useEffect(() => {
    if (!activeExecutionId || autoOpenedExecutionId.current === activeExecutionId) {
      return;
    }
    autoOpenedExecutionId.current = activeExecutionId;
    setPanelOpen(true);
    setTraceExecutionId(activeExecutionId);
    setShowPrompt(false);
  }, [activeExecutionId]);

  function openPanel() {
    setPanelOpen(true);
    if (block.currentExecution && isExecutionActive(block.currentExecution.status)) {
      setTraceExecutionId(block.currentExecution.id);
      setShowPrompt(false);
      return;
    }
    setShowPrompt(true);
    setPrompt(block.outputStatus === 'notRun' ? block.generationPrompt : '');
  }

  async function rerun() {
    try {
      const execution = await rerunMutation.mutateAsync({
        block,
        investigationVersion: investigation.version,
      });
      setPanelOpen(true);
      setTraceExecutionId(execution.id);
      setShowPrompt(false);
      autoOpenedExecutionId.current = execution.id;
    } catch {
      // The mutation owns user-facing error handling.
    }
  }

  const actionItems: MenuItemProps[] = [];
  if (block.kind === 'query') {
    actionItems.push({
      key: 'rerun',
      label: t('Rerun'),
      disabled:
        !canRun ||
        rerunMutation.isPending ||
        isExecutionActive(block.currentExecution?.status) ||
        !(block.generationPrompt || block.content).trim(),
      onAction: () => void rerun(),
    });
  }
  actionItems.push(
    {
      key: 'refine',
      label: t('Refine'),
      disabled: waitingForDependencies,
      onAction: openPanel,
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
          message: t('Are you sure you want to delete this cell?'),
          priority: 'danger',
          confirmText: t('Delete'),
          onConfirm: () =>
            deleteMutation.mutate({
              block,
              investigationVersion: investigation.version,
            }),
        }),
    }
  );

  const cellActions = (
    <CellActions flexShrink={0}>
      <DropdownMenu
        position="bottom-end"
        usePortal
        triggerProps={{
          size: 'xs',
          variant: 'transparent',
          showChevron: false,
          icon: <IconEllipsis size="xs" />,
          'aria-label': t('Cell actions for %s', displayTitle),
        }}
        items={actionItems}
      />
    </CellActions>
  );

  const panel = panelOpen ? (
    <RefinementPanel
      block={block}
      canRun={canRun}
      investigation={investigation}
      prompt={prompt}
      setPrompt={setPrompt}
      showPrompt={showPrompt}
      setShowPrompt={setShowPrompt}
      traceExecutionId={traceExecutionId}
      setTraceExecutionId={setTraceExecutionId}
      onClose={() => setPanelOpen(false)}
    />
  ) : null;

  return (
    <Stack
      as="section"
      width="100%"
      padding={block.kind === 'query' ? 'xl 0' : '0'}
      borderBottom={block.kind === 'query' ? 'primary' : undefined}
      data-test-id={`investigation-cell-${block.id}`}
      data-has-divider={block.kind === 'query'}
    >
      {block.kind === 'query' ? (
        <Fragment>
          <QueryResult
            actions={cellActions}
            block={block}
            progressState={progressState}
          />
          {panel}
        </Fragment>
      ) : (
        <Fragment>
          <CellResult
            block={block}
            actions={cellActions}
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

function CellResult({
  actions,
  block,
  progressState,
  streamedMarkdown,
}: {
  actions: React.ReactNode;
  block: InvestigationBlock;
  progressState: CellProgressState;
  streamedMarkdown?: string | null;
}) {
  const markdown =
    streamedMarkdown ?? getTextOutput(block.output) ?? (block.content.trim() || null);
  return (
    <CellHoverSurface
      position="relative"
      flex={1}
      minWidth={0}
      gap="sm"
      data-test-id="text-cell-result"
      data-cell-variant="unbordered"
    >
      <Container position="absolute" top={0} right={0}>
        {actions}
      </Container>
      <CellExecutionAlert block={block} />
      {markdown ? (
        <SeerMarkdown raw={markdown} />
      ) : (
        <CellProgress state={progressState} />
      )}
    </CellHoverSurface>
  );
}

function QueryResult({
  actions,
  block,
  progressState,
}: {
  actions: React.ReactNode;
  block: InvestigationBlock;
  progressState: CellProgressState;
}) {
  const [expanded, setExpanded] = useState(block.config.autoRun !== true);
  const output = getQueryOutput(block.output);
  const chart =
    output?.preferredView === 'chart' ? getRenderableChart(output.chart) : null;
  const title = block.title || chart?.title || t('Untitled query');
  const chartHeaderTitle = getDisplayText(block.display, 'title') || chart?.title;
  const chartHeaderMetadata =
    getDisplayText(block.display, 'subtitle') ||
    chart?.subtitle ||
    getChartMetadata(chart);

  return (
    <CellHoverSurface width="100%" gap="sm">
      <Flex width="100%" align="center" gap="xs" data-test-id="query-cell-toolbar">
        <QueryDisclosureButton
          size="sm"
          variant="transparent"
          icon={<IconChevron direction={expanded ? 'down' : 'right'} size="xs" />}
          aria-label={t('Toggle %s', title)}
          aria-expanded={expanded}
          onClick={() => setExpanded(value => !value)}
        >
          <Text data-test-id="query-cell-title" size="sm" tabular>
            {title}
          </Text>
        </QueryDisclosureButton>
        {actions}
      </Flex>
      {expanded ? (
        <Stack
          width="100%"
          flex={1}
          minWidth={0}
          gap="0"
          overflow="hidden"
          border="primary"
          radius="md"
          data-test-id="query-cell-result"
          data-cell-variant="bordered"
        >
          <Flex
            align="start"
            justify="between"
            gap="md"
            padding="md lg"
            background="secondary"
            borderBottom="primary"
            data-test-id="query-cell-header"
          >
            <Stack gap="2xs" minWidth={0} flex={1}>
              <Heading as="h3" size="md">
                {chartHeaderTitle || title}
              </Heading>
              {chartHeaderMetadata ? (
                <Text size="sm" variant="muted">
                  {chartHeaderMetadata}
                </Text>
              ) : null}
            </Stack>
          </Flex>
          <Container width="100%" overflow="hidden" padding={chart ? 'md lg' : '0'}>
            <CellExecutionAlert block={block} />
            {chart ? (
              <ChartContent data={chart} showHeader={false} />
            ) : output?.tableMarkdown ? (
              <SeerMarkdown raw={output.tableMarkdown} components={{Table: FlushTable}} />
            ) : (
              <Container padding="md lg">
                <CellProgress state={progressState} />
              </Container>
            )}
          </Container>
        </Stack>
      ) : null}
    </CellHoverSurface>
  );
}

type CellProgressState =
  | 'running'
  | 'waiting'
  | 'failed'
  | 'cancelled'
  | 'blockedByFailure'
  | 'blockedByCancellation'
  | null;

function CellExecutionAlert({block}: {block: InvestigationBlock}) {
  const execution = block.currentExecution;
  if (execution?.status !== 'failed' && execution?.status !== 'cancelled') {
    return null;
  }
  const failed = execution.status === 'failed';
  return (
    <Alert.Container data-test-id={`cell-execution-${execution.status}`}>
      <Alert variant={failed ? 'danger' : 'warning'}>
        {execution.error?.message ||
          (failed ? t('This Seer run failed.') : t('This Seer run was cancelled.'))}
      </Alert>
    </Alert.Container>
  );
}

function CellProgress({state}: {state: CellProgressState}) {
  if (!state) {
    return <Text variant="muted">{t('This cell has no output yet.')}</Text>;
  }
  let message = t('Cancelled because a previous cell failed.');
  if (state === 'running') {
    message = t('Seer is working on this cell…');
  } else if (state === 'waiting') {
    message = t('Waiting for previous cells…');
  } else if (state === 'failed') {
    message = t('This cell failed to run.');
  } else if (state === 'cancelled') {
    message = t('This cell run was cancelled.');
  } else if (state === 'blockedByCancellation') {
    message = t('Waiting because a previous cell was cancelled.');
  }
  return (
    <Flex align="center" gap="xs" data-test-id={`cell-progress-${state}`}>
      <IconSeer
        size="xs"
        animation={['running', 'waiting'].includes(state) ? 'waiting' : undefined}
      />
      <Text variant="muted">{message}</Text>
    </Flex>
  );
}

function getCellProgressState(
  block: InvestigationBlock,
  blocks: InvestigationBlock[]
): CellProgressState {
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

export function shouldDisplayInvestigationBlock(
  block: InvestigationBlock,
  blocks: InvestigationBlock[]
) {
  // Waiting cells have no useful content yet. Dependency failures and cancellations
  // remain visible so users can understand why downstream work stopped.
  return getCellProgressState(block, blocks) !== 'waiting';
}

export function shouldPollInvestigationBlocks(blocks: InvestigationBlock[]) {
  return blocks.some(
    block =>
      isExecutionActive(block.outputStatus) ||
      getCellProgressState(block, blocks) === 'waiting'
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
function FlushTable({children}: {children: React.ReactNode}) {
  return (
    <Container overflowX="auto">
      <QueryTable>{children}</QueryTable>
    </Container>
  );
}

type RefinementPanelProps = {
  block: InvestigationBlock;
  canRun: boolean;
  investigation: InvestigationDetail;
  onClose: () => void;
  prompt: string;
  setPrompt: (prompt: string) => void;
  setShowPrompt: (showPrompt: boolean) => void;
  setTraceExecutionId: (executionId: string | null) => void;
  showPrompt: boolean;
  traceExecutionId: string | null;
};

function RefinementPanel({
  block,
  canRun,
  investigation,
  onClose,
  prompt,
  setPrompt,
  setShowPrompt,
  setTraceExecutionId,
  showPrompt,
  traceExecutionId,
}: RefinementPanelProps) {
  const organizationSlug = useOrganization().slug;
  const queryClient = useQueryClient();
  const updatePromptMutation = useUpdateInvestigationBlockPromptMutation(
    organizationSlug,
    investigation.id
  );
  const runMutation = useRunInvestigationBlockMutation(
    organizationSlug,
    investigation.id
  );
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
  const executionId = traceExecutionId;
  const executionOptions = investigationExecutionDetailQueryOptions({
    organizationSlug,
    investigationId: investigation.id,
    blockId: block.id,
    executionId: executionId ?? 'disabled',
  });
  const executionQuery = useQuery({
    ...executionOptions,
    enabled: Boolean(executionId),
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

  async function submit() {
    const nextPrompt = prompt.trim();
    if (!nextPrompt) {
      return;
    }

    try {
      const updatedBlock = await updatePromptMutation.mutateAsync({
        block,
        investigationVersion: investigation.version,
        prompt: nextPrompt,
      });
      const investigationVersion =
        investigation.version + (updatedBlock.version === block.version ? 0 : 1);
      const started = await runMutation.mutateAsync({
        block: updatedBlock,
        investigationVersion,
      });
      setTraceExecutionId(started.id);
      setShowPrompt(false);
    } catch {
      addErrorMessage(t('Unable to start this Seer run.'));
    }
  }

  function handlePromptKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void submit();
    }
  }

  const isSubmitting = updatePromptMutation.isPending || runMutation.isPending;

  if (showPrompt) {
    return (
      <Stack width="100%" marginTop="lg" gap="md">
        <Flex align="center" justify="between" gap="sm">
          <Flex align="center" gap="sm">
            <IconSeer size="xs" />
            <Text monospace>{t('Ask Seer to refine')}</Text>
          </Flex>
          {elapsed === null ? null : <ElapsedDuration milliseconds={elapsed} />}
        </Flex>
        <Stack gap="md">
          <RefinementPrompt>
            <RefinementTextArea
              aria-label={t('Instructions for Seer')}
              autosize
              autoFocus
              rows={3}
              placeholder={t(
                "Tell Seer how you'd like to refine or explore this analysis"
              )}
              value={prompt}
              onChange={event => setPrompt(event.target.value)}
              onKeyDown={handlePromptKeyDown}
            />
            <RefinementReturnIcon aria-hidden="true">
              <IconReturn size="xs" />
            </RefinementReturnIcon>
          </RefinementPrompt>
          <Flex align="center" gap="sm">
            <Button
              size="sm"
              icon={<IconClose size="xs" />}
              aria-label={t('Cancel Seer request')}
              onClick={onClose}
              disabled={isSubmitting}
            />
            <Button
              size="sm"
              icon={<IconArrow direction="right" size="xs" />}
              busy={isSubmitting}
              disabled={!canRun || !prompt.trim()}
              onClick={() => void submit()}
            >
              {t('Submit')}
            </Button>
          </Flex>
        </Stack>
      </Stack>
    );
  }

  return (
    <RefinementDisclosure defaultExpanded size="sm">
      <AgentActivityDisclosureTitle
        leadingItems={<IconSeer size="xs" animation={active ? 'waiting' : undefined} />}
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
      <RefinementDisclosureContent>
        <Stack gap="md">
          <Transcript
            blocks={execution?.blocks ?? []}
            completedAt={currentExecution?.completedAt ?? null}
            active={active}
          />
          {executionId && execution?.pendingUserInput ? (
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
            {active && executionId ? (
              <Button
                size="sm"
                busy={stopMutation.isPending}
                onClick={() => stopMutation.mutate({blockId: block.id, executionId})}
              >
                {t('Stop')}
              </Button>
            ) : null}
            {status && !active ? (
              <Button
                size="sm"
                variant="primary"
                onClick={() => {
                  setPrompt('');
                  setShowPrompt(true);
                }}
              >
                {t('Ask Seer again')}
              </Button>
            ) : null}
          </Flex>
        </Stack>
      </RefinementDisclosureContent>
    </RefinementDisclosure>
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
  blocks,
  completedAt,
}: {
  active: boolean;
  blocks: InvestigationTranscriptBlock[];
  completedAt: string | null;
}) {
  const now = useNow(active);
  const visibleBlocks = useMemo(
    () => blocks.filter(isRenderableTranscriptBlock),
    [blocks]
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
        const end =
          visibleBlocks[index + 1]?.timestamp ?? completedAt ?? (active ? now : null);
        const duration = getElapsedMilliseconds(block.timestamp, end);
        return (
          <Grid key={block.id} columns="minmax(0, 1fr) auto" align="start" gap="md">
            <BlockComponent
              block={block}
              blockIndex={index}
              blocks={explorerBlocks}
              readOnly
              showThinking
            />
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

function isRenderableTranscriptBlock(block: InvestigationTranscriptBlock, index: number) {
  if (isInternalPromptBlock(block, index)) {
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
  'chart' | 'preferredView' | 'tableMarkdown'
>;

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

const QueryDisclosureButton = styled(Button)`
  flex: 1;
  justify-content: flex-start;
  padding-inline: ${p => p.theme.space.xs};
  text-align: left;
`;

const CellActions = styled(Flex)`
  opacity: 0;
  pointer-events: none;
`;

const CellHoverSurface = styled(Stack)`
  &:hover ${CellActions},
  &:focus-within ${CellActions} {
    opacity: 1;
    pointer-events: auto;
  }

  @media (hover: none) {
    ${CellActions} {
      opacity: 1;
      pointer-events: auto;
    }
  }
`;

const QueryTable = styled('table')`
  min-width: 100%;
  border-collapse: collapse;
`;

const RefinementDisclosure = styled(Disclosure)`
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

const RefinementPrompt = styled('div')`
  position: relative;
`;

const RefinementTextArea = styled(TextArea)`
  width: 100%;
  padding-right: ${p => p.theme.space['2xl']};
`;

const RefinementReturnIcon = styled('span')`
  position: absolute;
  top: ${p => p.theme.space.md};
  right: ${p => p.theme.space.md};
  color: ${p => p.theme.tokens.content.secondary};
  pointer-events: none;
`;

const RefinementDisclosureContent = styled(Disclosure.Content)`
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
