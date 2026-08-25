import {useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {useDebouncer} from '@tanstack/react-pacer';
import {useQuery, useQueryClient} from '@tanstack/react-query';

import {Alert} from '@sentry/scraps/alert';
import {Badge} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {Input} from '@sentry/scraps/input';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Heading, Text} from '@sentry/scraps/text';
import {TextArea} from '@sentry/scraps/textarea';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import Feature from 'sentry/components/acl/feature';
import {FeatureDisabled} from 'sentry/components/acl/featureDisabled';
import {AnalyticsArea} from 'sentry/components/analyticsArea';
import {openConfirmModal} from 'sentry/components/confirm';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {FeedbackButton} from 'sentry/components/feedbackButton/feedbackButton';
import * as Layout from 'sentry/components/layouts/thirds';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {IconAdd, IconClose, IconRefresh, IconStack} from 'sentry/icons';
import {IconEllipsis} from 'sentry/icons/iconEllipsis';
import {t} from 'sentry/locale';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useCopyToClipboard} from 'sentry/utils/useCopyToClipboard';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {
  getInvestigationDetailQueryOptions,
  getInvestigationOrchestrationPollInterval,
  investigationListQueryOptions,
  investigationOrchestrationQueryOptions,
  investigationTitleGenerationQueryOptions,
  isInvestigationOrchestrationNotFoundError,
  shouldRetryInvestigationOrchestration,
  useAddInvestigationBlockMutation,
  useDeleteInvestigationMutation,
  useDuplicateInvestigationMutation,
  useRenameInvestigationMutation,
} from 'sentry/views/investigations/api';
import {
  InvestigationCell,
  shouldDisplayInvestigationBlock,
  shouldPollInvestigationBlocks,
} from 'sentry/views/investigations/detail/cell';
import {
  InvestigationOrchestrationWorkflow,
  isInvestigationOrchestrationStale,
  isOrchestrationTerminal,
} from 'sentry/views/investigations/detail/orchestrationWorkflow';
import {useOrchestrationCommands} from 'sentry/views/investigations/detail/useOrchestrationCommands';
import {updateInvestigationCache} from 'sentry/views/investigations/investigationCache';
import {InvestigationSummaryCard} from 'sentry/views/investigations/investigationSummaryCard';
import type {
  InvestigationBlockKind,
  InvestigationDetail,
  InvestigationOrchestration,
} from 'sentry/views/investigations/types';
import {RouteError} from 'sentry/views/routeError';

const DEFAULT_INVESTIGATION_TITLE = 'Untitled investigation';

function FeatureDisabledPage() {
  return (
    <Stack flex={1} padding="2xl 3xl">
      <FeatureDisabled
        features="organizations:investigations"
        featureName={t('Investigations')}
      />
    </Stack>
  );
}

function ClosedMembershipPage() {
  return (
    <Stack flex={1} padding="2xl 3xl">
      <Alert.Container>
        <Alert variant="warning">
          {t('Investigations are only available to organizations with open membership.')}
        </Alert>
      </Alert.Container>
    </Stack>
  );
}

function InvestigationBootstrapPage({investigationId}: {investigationId: string}) {
  const organization = useOrganization();
  const detailOptions = getInvestigationDetailQueryOptions(
    organization.slug,
    investigationId
  );
  const {
    data: investigation,
    error,
    isError,
    isPending,
  } = useQuery({
    ...detailOptions,
    refetchInterval: query => {
      const data = query.state.data?.json;
      if (data?.mode === 'agentic') {
        return false;
      }
      return shouldPollInvestigationBlocks(data?.blocks ?? []) ||
        isTitleGenerationActive(data?.titleGeneration?.status)
        ? 2000
        : false;
    },
  });

  if (isPending && !investigation) {
    return <LoadingIndicator />;
  }
  if (isError && !investigation) {
    return (
      <Stack flex={1} padding="2xl 3xl">
        <RouteError error={error} />
      </Stack>
    );
  }
  if (!investigation) {
    return null;
  }

  return <InvestigationPageContent investigation={investigation} />;
}

function InvestigationPageContent({investigation}: {investigation: InvestigationDetail}) {
  const organization = useOrganization();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const {copy} = useCopyToClipboard();
  const [draftTitle, setDraftTitle] = useState<string | null>(null);
  const persistedTitle = useRef(investigation.title);
  const titleGenerationSettledFor = useRef<string | null>(null);
  const polledNotebookRevision = useRef<{
    investigationId: string;
    revision: number;
  } | null>(null);
  const [notebookClearFence, setNotebookClearFence] = useState<{
    investigationId: string;
    revision: number;
  } | null>(null);
  const detailOptions = getInvestigationDetailQueryOptions(
    organization.slug,
    investigation.id
  );
  const orchestrationQuery = useQuery({
    ...investigationOrchestrationQueryOptions(organization.slug, investigation.id),
    enabled: investigation.mode === 'agentic',
    retry: shouldRetryInvestigationOrchestration,
    retryDelay: attempt => Math.min(1000 * 2 ** attempt, 10_000),
    refetchInterval: query =>
      getInvestigationOrchestrationPollInterval({
        error: query.state.error,
        failureCount: query.state.fetchFailureCount,
        orchestration: query.state.data?.json,
      }),
  });
  const {commandState, displayedOrchestration, hideNotebookBlocks, submitCommand} =
    useOrchestrationCommands({
      investigationId: investigation.id,
      orchestration: orchestrationQuery.data,
      organizationSlug: organization.slug,
    });
  const streamedAgenticTitle =
    investigation.mode === 'agentic'
      ? orchestrationQuery.data?.report.metadata.title
      : null;
  const titleGenerationQuery = useQuery({
    ...investigationTitleGenerationQueryOptions(organization.slug, investigation.id),
    enabled: isTitleGenerationActive(investigation.titleGeneration?.status),
    refetchInterval: query =>
      isTitleGenerationActive(query.state.data?.json.status) ? 500 : false,
  });
  const generatedTitlePreview =
    draftTitle === null &&
    investigation.title === DEFAULT_INVESTIGATION_TITLE &&
    isTitleGenerationActive(titleGenerationQuery.data?.status)
      ? titleGenerationQuery.data?.preview
      : null;
  const displayedTitle =
    draftTitle ?? streamedAgenticTitle ?? generatedTitlePreview ?? investigation.title;

  useEffect(() => {
    if (
      investigation.mode === 'agentic' &&
      orchestrationQuery.data?.report.metadata.status === 'completed' &&
      streamedAgenticTitle &&
      draftTitle === null
    ) {
      persistedTitle.current = streamedAgenticTitle;
    }
  }, [
    investigation.mode,
    draftTitle,
    orchestrationQuery.data?.report.metadata.status,
    streamedAgenticTitle,
  ]);

  useEffect(() => {
    const nextRevision = orchestrationQuery.data?.notebookRevision;
    if (nextRevision === undefined) {
      return;
    }
    const detailRevision = investigation.orchestration?.notebookRevision;
    const previousRevision = polledNotebookRevision.current;
    polledNotebookRevision.current = {
      investigationId: investigation.id,
      revision: nextRevision,
    };
    if (
      (detailRevision !== undefined && detailRevision !== nextRevision) ||
      (detailRevision === undefined &&
        previousRevision?.investigationId === investigation.id &&
        previousRevision.revision !== nextRevision)
    ) {
      void queryClient.invalidateQueries({queryKey: detailOptions.queryKey});
    }
  }, [
    detailOptions.queryKey,
    investigation.id,
    investigation.orchestration?.notebookRevision,
    orchestrationQuery.data?.notebookRevision,
    queryClient,
  ]);

  useEffect(() => {
    if (!hideNotebookBlocks) {
      return;
    }
    setNotebookClearFence(current =>
      current?.investigationId === investigation.id
        ? current
        : {
            investigationId: investigation.id,
            revision:
              investigation.orchestration?.notebookRevision ??
              orchestrationQuery.data?.notebookRevision ??
              0,
          }
    );
  }, [
    hideNotebookBlocks,
    investigation.id,
    investigation.orchestration?.notebookRevision,
    orchestrationQuery.data?.notebookRevision,
  ]);

  const detailNotebookRevision = investigation.orchestration?.notebookRevision;
  const orchestrationNotebookRevision = orchestrationQuery.data?.notebookRevision;
  const notebookRevisionMismatch =
    investigation.mode === 'agentic' &&
    detailNotebookRevision !== undefined &&
    orchestrationNotebookRevision !== undefined &&
    detailNotebookRevision !== orchestrationNotebookRevision;
  const notebookClearObserved =
    notebookClearFence?.investigationId === investigation.id &&
    ((detailNotebookRevision !== undefined &&
      detailNotebookRevision > notebookClearFence.revision) ||
      (detailNotebookRevision === undefined &&
        orchestrationNotebookRevision !== undefined &&
        orchestrationNotebookRevision > notebookClearFence.revision &&
        (investigation.blocks ?? []).every(
          block =>
            !block.reportProvenance ||
            block.reportProvenance.reportRevision ===
              displayedOrchestration?.report.revision
        )));

  useEffect(() => {
    if (notebookClearFence?.investigationId !== investigation.id) {
      return;
    }
    const invalidationFailedBeforeClear =
      Boolean(commandState.error) &&
      !hideNotebookBlocks &&
      (orchestrationNotebookRevision ?? notebookClearFence.revision) <=
        notebookClearFence.revision;
    if (notebookClearObserved || invalidationFailedBeforeClear) {
      setNotebookClearFence(null);
    }
  }, [
    commandState.error,
    hideNotebookBlocks,
    investigation.id,
    notebookClearFence,
    notebookClearObserved,
    orchestrationNotebookRevision,
  ]);

  useEffect(() => {
    const status = titleGenerationQuery.data?.status;
    if (isTitleGenerationActive(status)) {
      if (titleGenerationSettledFor.current === investigation.id) {
        titleGenerationSettledFor.current = null;
      }
      return;
    }
    if (
      (status === 'completed' || status === 'failed') &&
      titleGenerationSettledFor.current !== investigation.id
    ) {
      titleGenerationSettledFor.current = investigation.id;
      void queryClient.invalidateQueries({queryKey: detailOptions.queryKey});
      void queryClient.invalidateQueries({
        queryKey: investigationListQueryOptions({
          organizationSlug: organization.slug,
        }).queryKey,
      });
    }
  }, [
    detailOptions.queryKey,
    investigation.id,
    organization.slug,
    queryClient,
    titleGenerationQuery.data?.status,
  ]);

  const renameMutation = useRenameInvestigationMutation(
    organization.slug,
    investigation.id,
    {
      onSuccess: updated => {
        persistedTitle.current = updated.title;
      },
      onError: (_error, attemptedTitle) => {
        addErrorMessage(t('Unable to rename investigation.'));
        setDraftTitle(current =>
          current?.trim() === attemptedTitle ? persistedTitle.current : current
        );
        updateInvestigationCache(
          queryClient,
          organization.slug,
          investigation.id,
          current =>
            current.title === attemptedTitle
              ? {...current, title: persistedTitle.current}
              : current
        );
      },
    }
  );
  const renameDebouncer = useDebouncer(
    (nextTitle: string) => {
      const title = nextTitle.trim();
      if (title && title !== persistedTitle.current) {
        renameMutation.mutate(title);
      }
    },
    {wait: 500, onUnmount: debouncer => debouncer.flush()}
  );

  useEffect(() => {
    if (draftTitle === null) {
      persistedTitle.current = investigation.title;
    }
  }, [draftTitle, investigation.title]);
  const duplicateMutation = useDuplicateInvestigationMutation(organization.slug, {
    onSuccess: duplicate => {
      addSuccessMessage(t('Investigation duplicated.'));
      navigate(getInvestigationPath(organization.slug, duplicate.id));
    },
    onError: () => addErrorMessage(t('Unable to duplicate investigation.')),
  });
  const deleteMutation = useDeleteInvestigationMutation(organization.slug, {
    onMutate: () => renameDebouncer.cancel(),
    onSuccess: () => {
      queryClient.removeQueries({
        queryKey: detailOptions.queryKey,
        exact: true,
      });
      addSuccessMessage(t('Investigation deleted.'));
      navigate(`/organizations/${organization.slug}/explore/investigations/`);
    },
    onError: () => addErrorMessage(t('Unable to delete investigation.')),
  });
  const addBlockMutation = useAddInvestigationBlockMutation(
    organization.slug,
    investigation.id,
    {onError: () => addErrorMessage(t('Unable to add cell.'))}
  );

  function handleTitleChange(nextTitle: string) {
    setDraftTitle(nextTitle);
    updateInvestigationCache(
      queryClient,
      organization.slug,
      investigation.id,
      current => ({...current, title: nextTitle})
    );
    renameDebouncer.maybeExecute(nextTitle);
  }

  function handleTitleBlur() {
    renameDebouncer.cancel();
    if (draftTitle === null) {
      return;
    }
    const title = draftTitle.trim();
    if (title) {
      if (title !== draftTitle) {
        setDraftTitle(title);
        updateInvestigationCache(
          queryClient,
          organization.slug,
          investigation.id,
          current => ({...current, title})
        );
      }
      if (title !== persistedTitle.current) {
        renameMutation.mutate(title);
      }
      return;
    }
    setDraftTitle(null);
    updateInvestigationCache(
      queryClient,
      organization.slug,
      investigation.id,
      current => ({...current, title: persistedTitle.current})
    );
  }

  const blocks = investigation.blocks ?? [];
  const failedBlock = blocks.find(block => block.currentExecution?.status === 'failed');
  const hasFailureCancellation = blocks.some(
    block =>
      block.currentExecution?.status === 'cancelled' &&
      block.currentExecution.error?.code === 'investigation_execution_failed'
  );
  const investigationExecutionFailed = Boolean(failedBlock || hasFailureCancellation);
  const summaryBlock =
    investigation.mode !== 'agentic' && investigation.template ? blocks[0] : undefined;
  const notebookCells = summaryBlock ? blocks.slice(1) : blocks;
  const visibleSummaryBlock =
    summaryBlock && shouldDisplayInvestigationBlock(summaryBlock, blocks)
      ? summaryBlock
      : undefined;
  const visibleNotebookCells = notebookCells.filter(block =>
    shouldDisplayInvestigationBlock(block, blocks)
  );
  const shouldHideNotebookBlocks =
    (investigation.mode === 'agentic' && orchestrationQuery.isPending) ||
    notebookRevisionMismatch ||
    hideNotebookBlocks ||
    Boolean(
      notebookClearFence?.investigationId === investigation.id && !notebookClearObserved
    );
  const agenticReport =
    investigation.mode === 'agentic' && displayedOrchestration
      ? {
          commandState,
          currentBlockKey: displayedOrchestration.report.currentBlockKey,
          currentBlockStatus: displayedOrchestration.report.currentBlockStatus,
          onCommand: submitCommand,
          reportStatus: displayedOrchestration.report.status,
        }
      : undefined;
  const orchestrationStale = displayedOrchestration
    ? isInvestigationOrchestrationStale(displayedOrchestration)
    : false;
  const orchestrationProgress = displayedOrchestration
    ? getOrchestrationProgressLabel(displayedOrchestration)
    : formatStatus(investigation.status);
  const retryOrchestrationTarget = displayedOrchestration
    ? ['failed', 'partial_failed'].includes(displayedOrchestration.report.status) ||
      ['failed', 'stalled', 'reauth_required'].includes(
        displayedOrchestration.report.currentBlockStatus ?? ''
      )
      ? 'report'
      : 'run'
    : 'run';
  const canRetryOrchestration = Boolean(
    displayedOrchestration &&
    (orchestrationStale ||
      displayedOrchestration.status === 'failed' ||
      retryOrchestrationTarget === 'report' ||
      ['failed', 'stalled', 'cancelled', 'reauth_required'].includes(
        displayedOrchestration.broadScan.status
      ))
  );
  const orchestrationMetadata = displayedOrchestration
    ? orchestrationStale
      ? t(
          '%s. Investigation progress has not updated for two minutes. Retry the investigation to reconnect and continue.',
          orchestrationProgress
        )
      : t('%s.', orchestrationProgress)
    : t(
        '%s. Last updated %s.',
        formatStatus(investigation.status),
        formatNotebookDate(investigation.dateUpdated)
      );

  async function handleAddBlock({
    kind,
    prompt,
    title,
  }: {
    kind: InvestigationBlockKind;
    prompt: string;
    title: string;
  }) {
    await addBlockMutation.mutateAsync({investigation, kind, prompt, title});
  }

  return (
    <SentryDocumentTitle title={displayedTitle} orgSlug={organization.slug}>
      <Stack flex={1}>
        <Layout.Title>
          <HeaderBreadcrumbs
            align="center"
            gap="sm"
            minWidth={0}
            data-test-id="investigation-breadcrumbs"
            data-text-size="md"
          >
            <IconStack size="md" />
            <HeaderBreadcrumbLink
              to={`/organizations/${organization.slug}/explore/investigations/`}
            >
              {t('Investigations')}
            </HeaderBreadcrumbLink>
            <HeaderDivider>/</HeaderDivider>
            <HeaderInvestigationTitle>{displayedTitle}</HeaderInvestigationTitle>
            <DropdownMenu
              items={[
                {
                  key: 'copy-link',
                  label: t('Copy link'),
                  onAction: () =>
                    copy(
                      `${window.location.origin}${getInvestigationPath(
                        organization.slug,
                        investigation.id
                      )}`,
                      {successMessage: t('Investigation link copied.')}
                    ),
                },
                {
                  key: 'duplicate',
                  label: t('Duplicate'),
                  onAction: () => duplicateMutation.mutate(investigation),
                },
                {
                  key: 'delete',
                  label: t('Delete'),
                  priority: 'danger',
                  onAction: () =>
                    openConfirmModal({
                      message: t('Are you sure you want to delete this investigation?'),
                      priority: 'danger',
                      confirmText: t('Delete'),
                      onConfirm: () => deleteMutation.mutate(investigation),
                    }),
                },
              ]}
              triggerProps={{
                size: 'sm',
                showChevron: false,
                variant: 'transparent',
                icon: <IconEllipsis />,
                'aria-label': t('Investigation actions'),
              }}
              position="bottom-end"
              usePortal
            />
          </HeaderBreadcrumbs>
        </Layout.Title>
        <InvestigationHeader as="header" width="100%" padding="xl">
          <Grid
            columns="minmax(0, 1fr) auto"
            align="start"
            gap="lg"
            width="100%"
            maxWidth="885px"
            margin="0 auto"
          >
            <Stack gap="xs" minWidth={0}>
              <NotebookTitleInput
                aria-label={t('Investigation title')}
                value={displayedTitle}
                onChange={event => handleTitleChange(event.target.value)}
                onBlur={handleTitleBlur}
                maxLength={200}
                aria-busy={renameMutation.isPending}
              />
              <Text variant={orchestrationStale ? 'warning' : 'muted'}>
                {orchestrationMetadata}
              </Text>
            </Stack>
            <Flex align="center" gap="sm">
              <FeedbackButton
                feedbackOptions={{
                  formTitle: t('Give feedback on this investigation'),
                  messagePlaceholder: t('What was useful, incorrect, or missing?'),
                  tags: {
                    'feedback.source': 'investigation',
                    'feedback.owner': 'ml-ai',
                    'investigation.id': investigation.id,
                    'investigation.source_type': investigation.sourceType,
                    ...(investigation.template
                      ? {'investigation.template': investigation.template.key}
                      : {}),
                  },
                }}
              >
                {t('Give feedback')}
              </FeedbackButton>
              <Badge
                variant={
                  orchestrationStale
                    ? 'warning'
                    : getStatusVariant(
                        displayedOrchestration?.status ?? investigation.status
                      )
                }
              >
                {orchestrationProgress}
              </Badge>
              {canRetryOrchestration ? (
                <Button
                  size="xs"
                  variant="transparent"
                  aria-label={t('Retry investigation')}
                  busy={
                    commandState.pendingTarget ===
                    (retryOrchestrationTarget === 'report' ? 'report-action' : 'run')
                  }
                  disabled={commandState.isPending}
                  icon={<IconRefresh />}
                  onClick={() =>
                    submitCommand(
                      {type: 'retry', target: retryOrchestrationTarget},
                      retryOrchestrationTarget === 'report' ? 'report-action' : 'run'
                    )
                  }
                />
              ) : null}
              {displayedOrchestration &&
              !isOrchestrationTerminal(displayedOrchestration.status) ? (
                <Button
                  size="xs"
                  variant="transparent"
                  aria-label={t('Cancel investigation')}
                  busy={commandState.pendingTarget === 'cancel'}
                  disabled={commandState.isPending}
                  icon={<IconClose />}
                  onClick={() =>
                    submitCommand(
                      {type: 'cancel', reason: t('Cancelled by the user')},
                      'cancel'
                    )
                  }
                />
              ) : null}
            </Flex>
          </Grid>
        </InvestigationHeader>
        <Layout.Body>
          <Layout.Main width="full">
            <InvestigationCanvas>
              {investigationExecutionFailed ? (
                <InvestigationFailureAlert data-test-id="investigation-execution-failed">
                  <Alert variant="danger">
                    <strong>
                      {failedBlock
                        ? t('%s failed.', failedBlock.title || t('A cell'))
                        : t('The investigation failed.')}
                    </strong>{' '}
                    {failedBlock?.currentExecution?.error?.message ||
                      t('The agent run failed.')}{' '}
                    {t(
                      'The investigation was stopped and remaining cells were cancelled.'
                    )}
                  </Alert>
                </InvestigationFailureAlert>
              ) : null}
              {displayedOrchestration ? (
                <Container paddingBottom="xl">
                  <InvestigationOrchestrationWorkflow
                    commandState={commandState}
                    onCommand={submitCommand}
                    orchestration={displayedOrchestration}
                  />
                </Container>
              ) : orchestrationQuery.isError &&
                !isInvestigationOrchestrationNotFoundError(orchestrationQuery.error) ? (
                <InvestigationFailureAlert>
                  <Alert variant="danger">
                    {t('Unable to load investigation progress.')}
                  </Alert>
                </InvestigationFailureAlert>
              ) : null}
              {shouldHideNotebookBlocks ? null : (
                <NotebookSummaryCard
                  summary={investigation.summary}
                  summaryDescription={investigation.summaryDescription}
                />
              )}

              <Stack width="min(100%, 884px)" margin="0 auto" gap="0">
                {!shouldHideNotebookBlocks && visibleSummaryBlock ? (
                  <InvestigationCell
                    block={visibleSummaryBlock}
                    canRun={investigation.status === 'active'}
                    investigation={investigation}
                    agenticReport={agenticReport}
                  />
                ) : null}

                <Stack gap="xl">
                  {(shouldHideNotebookBlocks ? [] : visibleNotebookCells).map(block => (
                    <InvestigationCell
                      key={block.id}
                      block={block}
                      canRun={investigation.status === 'active'}
                      investigation={investigation}
                      agenticReport={agenticReport}
                    />
                  ))}
                </Stack>
                {investigation.status === 'active' && investigation.mode !== 'agentic' ? (
                  <AddCellComposer
                    isAdding={addBlockMutation.isPending}
                    onAdd={handleAddBlock}
                  />
                ) : null}
              </Stack>
            </InvestigationCanvas>
          </Layout.Main>
        </Layout.Body>
      </Stack>
    </SentryDocumentTitle>
  );
}

function AddCellComposer({
  isAdding,
  onAdd,
}: {
  isAdding: boolean;
  onAdd: (cell: {
    kind: InvestigationBlockKind;
    prompt: string;
    title: string;
  }) => Promise<void>;
}) {
  const [kind, setKind] = useState<InvestigationBlockKind | null>(null);
  const [title, setTitle] = useState('');
  const [prompt, setPrompt] = useState('');

  function reset() {
    setKind(null);
    setTitle('');
    setPrompt('');
  }

  async function handleAdd() {
    if (!kind || !prompt.trim()) {
      return;
    }
    try {
      await onAdd({kind, title: title.trim(), prompt: prompt.trim()});
      reset();
    } catch {
      // The mutation owns user-facing error handling and leaves the draft intact.
    }
  }

  if (!kind) {
    return (
      <AddCellActions align="center" justify="center" gap="sm">
        <Button size="sm" icon={<IconAdd />} onClick={() => setKind('text')}>
          {t('Add text cell (debug only)')}
        </Button>
        <Button size="sm" icon={<IconAdd />} onClick={() => setKind('query')}>
          {t('Add query cell (debug only)')}
        </Button>
      </AddCellActions>
    );
  }

  return (
    <CellComposer>
      <Stack gap="md">
        <Heading as="h2" size="md">
          {kind === 'text'
            ? t('Add text cell (debug only)')
            : t('Add query cell (debug only)')}
        </Heading>
        <Input
          aria-label={t('Cell title')}
          placeholder={t('Title (optional)')}
          value={title}
          onChange={event => setTitle(event.target.value)}
        />
        <TextArea
          aria-label={t('Cell instructions')}
          autosize
          autoFocus
          rows={3}
          placeholder={
            kind === 'text'
              ? t('Describe the text to generate')
              : t('Describe the query to run')
          }
          value={prompt}
          onChange={event => setPrompt(event.target.value)}
        />
        <Flex align="center" justify="end" gap="sm">
          <Button size="sm" onClick={reset} disabled={isAdding}>
            {t('Cancel')}
          </Button>
          <Button
            size="sm"
            variant="primary"
            busy={isAdding}
            disabled={!prompt.trim()}
            onClick={() => void handleAdd()}
          >
            {t('Add cell')}
          </Button>
        </Flex>
      </Stack>
    </CellComposer>
  );
}

function isTitleGenerationActive(status: string | null | undefined) {
  return status === 'pending' || status === 'running';
}

function getInvestigationPath(organizationSlug: string, investigationId: string) {
  return normalizeUrl(
    `/organizations/${organizationSlug}/explore/investigations/${investigationId}/`
  );
}

function formatStatus(status: string) {
  if (status === 'active') {
    return t('Active');
  }
  return status.replaceAll('_', ' ').replace(/^./, character => character.toUpperCase());
}

function formatNotebookDate(date: string) {
  return new Date(date).toISOString().slice(0, 10).replaceAll('-', '.');
}

function getStatusVariant(
  status: string
): 'danger' | 'info' | 'success' | 'warning' | 'muted' {
  if (status === 'completed' || status === 'active') {
    return 'success';
  }
  if (['failed', 'cancelled'].includes(status)) {
    return 'danger';
  }
  if (['pending', 'awaiting_input', 'stalled', 'reauth_required'].includes(status)) {
    return 'warning';
  }
  if (['processing', 'running'].includes(status)) {
    return 'info';
  }
  return 'muted';
}

function getOrchestrationProgressLabel(orchestration: InvestigationOrchestration) {
  if (orchestration.status === 'awaiting_input' || orchestration.pendingInput) {
    return t('Waiting for your prompt');
  }
  if (orchestration.status === 'failed') {
    return t('Investigation failed');
  }
  if (orchestration.status === 'cancelled') {
    return t('Investigation cancelled');
  }
  if (orchestration.status === 'completed') {
    return t('Investigation complete');
  }

  const hypotheses = orchestration.hypotheses;
  const settledHypotheses = hypotheses.filter(hypothesis =>
    ['supported', 'refuted', 'inconclusive', 'accepted', 'rejected'].includes(
      hypothesis.effectiveStatus
    )
  ).length;

  if (['intake', 'broad_scan', 'planning'].includes(orchestration.phase)) {
    return t('Creating hypotheses');
  }
  if (orchestration.phase === 'investigating') {
    return t('Verifying %s/%s hypotheses', settledHypotheses, hypotheses.length);
  }
  if (orchestration.phase === 'judging') {
    return t('Evaluating %s/%s hypotheses', settledHypotheses, hypotheses.length);
  }
  if (orchestration.phase === 'reporting') {
    return t('Building report');
  }
  if (orchestration.phase === 'metadata') {
    return t('Finalizing investigation');
  }
  return formatStatus(orchestration.phase);
}

const InvestigationCanvas = styled(Stack)`
  width: min(100%, calc(884px + ${p => p.theme.space['2xl']}));
  margin: 0 auto;
`;

const InvestigationHeader = styled(Container)`
  position: relative;

  &::after {
    /* The specified divider is intentionally as subtle as the secondary surface. */
    content: '';
    position: absolute;
    inset: auto 0 0;
    height: 1px;
    background: ${p => p.theme.tokens.background.secondary};
  }
`;

const NotebookSummaryCard = styled(InvestigationSummaryCard)`
  width: 100%;
  margin-bottom: ${p => p.theme.space.xl};
  padding-inline: ${p => p.theme.space.xl};
`;

const HeaderBreadcrumbs = styled(Flex)`
  height: 32px;
  overflow: hidden;
  font-size: ${p => p.theme.font.size.md};
  font-weight: ${p => p.theme.font.weight.sans.regular};
  line-height: 32px;
  white-space: nowrap;
`;

const HeaderBreadcrumbLink = styled(Link)`
  overflow: hidden;
  color: ${p => p.theme.tokens.content.secondary};
  text-decoration-line: underline;
  text-decoration-style: dotted;
  text-decoration-color: ${p => p.theme.tokens.border.primary};
  text-underline-offset: 5px;
  text-overflow: ellipsis;
`;

const HeaderDivider = styled('span')`
  color: ${p => p.theme.tokens.content.secondary};
`;

const HeaderInvestigationTitle = styled('span')`
  overflow: hidden;
  color: ${p => p.theme.tokens.content.primary};
  font-weight: ${p => p.theme.font.weight.sans.medium};
  text-decoration-line: underline;
  text-decoration-style: dotted;
  text-decoration-color: ${p => p.theme.tokens.border.primary};
  text-underline-offset: 5px;
  text-overflow: ellipsis;
`;

const NotebookTitleInput = styled(Input)`
  width: 100%;
  height: auto;
  margin: 0;
  padding: 0;
  color: ${p => p.theme.tokens.content.primary};
  background: transparent;
  border-color: transparent;
  border-radius: ${p => p.theme.radius.sm};
  box-shadow: none;
  font-size: ${p => p.theme.font.size['2xl']};
  font-weight: ${p => p.theme.font.weight.sans.medium};
  line-height: 1.25;

  &:hover,
  &:focus {
    background: ${p => p.theme.tokens.background.secondary};
    border-color: ${p => p.theme.tokens.border.primary};
  }
`;

const AddCellActions = styled(Flex)`
  padding: ${p => p.theme.space.xl} 0;
`;

const CellComposer = styled('section')`
  width: min(100%, 862px);
  margin: ${p => p.theme.space.lg} auto 0;
  padding: ${p => p.theme.space.xl};
  background: ${p => p.theme.tokens.background.secondary};
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
`;

export default function InvestigationDetailView() {
  const organization = useOrganization();
  const {investigationId} = useParams<{investigationId: string}>();

  return (
    <AnalyticsArea name="investigations.details" overrideParent>
      <Feature
        organization={organization}
        features="organizations:investigations"
        renderDisabled={() => <FeatureDisabledPage />}
      >
        {organization.openMembership ? (
          <InvestigationBootstrapPage investigationId={investigationId} />
        ) : (
          <ClosedMembershipPage />
        )}
      </Feature>
    </AnalyticsArea>
  );
}
