import {Fragment, useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {IconChat} from '@sentry/icons/chat';
import {IconEllipsis} from '@sentry/icons/ellipsis';
import {IconIssues} from '@sentry/icons/issues';
import {IconStack} from '@sentry/icons/stack';
import {useDebouncer} from '@tanstack/react-pacer';
import {useIsFetching, useQuery, useQueryClient} from '@tanstack/react-query';

import {Alert} from '@sentry/scraps/alert';
import {Tag} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {Input} from '@sentry/scraps/input';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Separator} from '@sentry/scraps/separator';
import {Heading, Text} from '@sentry/scraps/text';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import Feature from 'sentry/components/acl/feature';
import {FeatureDisabled} from 'sentry/components/acl/featureDisabled';
import {AnalyticsArea} from 'sentry/components/analyticsArea';
import {openConfirmModal} from 'sentry/components/confirm';
import {DateTime} from 'sentry/components/dateTime';
import {FeedbackButton} from 'sentry/components/feedbackButton/feedbackButton';
import * as Layout from 'sentry/components/layouts/thirds';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t, tct, tn} from 'sentry/locale';
import {parseLinkHeader} from 'sentry/utils/parseLinkHeader';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useCopyToClipboard} from 'sentry/utils/useCopyToClipboard';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {shouldRefreshOnFocus} from 'sentry/views/investigations/actionRequests/actionRequestDetails';
import {
  AnchoredActionRequests,
  groupActionRequestsByPlacement,
} from 'sentry/views/investigations/actionRequests/anchoredActionRequests';
import {
  getPrimaryActionRequest,
  isRunWorking,
  NextStepCard,
} from 'sentry/views/investigations/actionRequests/nextStepCard';
import {InvestigationActivity} from 'sentry/views/investigations/activity/investigationActivity';
import {
  getInvestigationDetailQueryOptions,
  investigationCommentCountsQueryOptions,
  investigationListQueryOptions,
  investigationOrchestrationQueryOptions,
  investigationTitleGenerationQueryOptions,
  isFollowUpPending,
  useDeleteInvestigationMutation,
  useDuplicateInvestigationMutation,
  useRenameInvestigationMutation,
} from 'sentry/views/investigations/api';
import {useBlockCommentsDrawer} from 'sentry/views/investigations/comments/useBlockCommentsDrawer';
import {useInvestigationComments} from 'sentry/views/investigations/comments/useInvestigationComments';
import {
  InvestigationNotebookBlock,
  isBlockWorking,
  shouldDisplayInvestigationBlock,
  shouldPollInvestigationBlocks,
} from 'sentry/views/investigations/detail/block';
import {InvestigationBlockPlaceholder} from 'sentry/views/investigations/detail/blockPlaceholder';
import {
  ACTIVITY_ELEMENT_ID,
  getInvestigationOutline,
  HYPOTHESES_ELEMENT_ID,
  InvestigationOutline,
  SUMMARY_ELEMENT_ID,
} from 'sentry/views/investigations/detail/outline';
import {InvestigationViewers} from 'sentry/views/investigations/detail/presence';
import {InvestigationRunTimer} from 'sentry/views/investigations/detail/runTimer';
import {
  InvestigationHypotheses,
  shouldPollInvestigationRun,
} from 'sentry/views/investigations/hypotheses/investigationHypotheses';
import {updateInvestigationCache} from 'sentry/views/investigations/investigationCache';
import {
  getHypothesisLLMContext,
  getInvestigationLLMContext,
  getInvestigationReference,
  useInvestigationAskSeer,
} from 'sentry/views/investigations/investigationLLMContext';
import {InvestigationSummaryCard} from 'sentry/views/investigations/investigationSummaryCard';
import {getInvestigationSource} from 'sentry/views/investigations/source';
import {getSeerStatusBlock} from 'sentry/views/investigations/statusBlock/getSeerStatusBlock';
import type {
  InvestigationActionRequest,
  InvestigationBlock,
  InvestigationDetail,
  InvestigationHypothesis,
  InvestigationOrchestration,
} from 'sentry/views/investigations/types';
import {
  getInvestigationPath,
  getInvestigationsPath,
  useInvestigationsEnabled,
} from 'sentry/views/investigations/utils';
import {TopBar} from 'sentry/views/navigation/topBar';
import {RouteError} from 'sentry/views/routeError';
import {useLLMContext} from 'sentry/views/seerExplorer/contexts/llmContext';
import {registerLLMContext} from 'sentry/views/seerExplorer/contexts/registerLLMContext';
import {useSeerExplorerContext} from 'sentry/views/seerExplorer/useSeerExplorerContext';

const DEFAULT_INVESTIGATION_TITLE = 'Untitled investigation';

const STATUS_TAG_VARIANT = {
  running: 'info',
  awaitingInput: 'warning',
  failed: 'danger',
  complete: 'success',
  cancelled: 'muted',
} as const;

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

/**
 * Action requests come with the investigation, which stops polling once the run is done
 * and which orchestration commands don't refresh. Refetch it whenever the next step moves
 * on, and return true until that refetch settles.
 */
function useRefetchStaleActionRequests(
  investigationId: string,
  orchestration: InvestigationOrchestration | undefined,
  actionRequests: InvestigationActionRequest[] | undefined
) {
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const detailQueryKey = getInvestigationDetailQueryOptions(
    organization.slug,
    investigationId
  ).queryKey;
  // Re-renders when the refetch starts and settles.
  useIsFetching({queryKey: detailQueryKey});
  const detailState = queryClient.getQueryState(detailQueryKey);
  const detailUpdates =
    (detailState?.dataUpdateCount ?? 0) + (detailState?.errorUpdateCount ?? 0);
  const nextStepKey = orchestration
    ? `${orchestration.report.revision}:${orchestration.report.nextStep?.status}`
    : null;
  const [refresh, setRefresh] = useState<{
    detailUpdates: number;
    initial: boolean;
    investigationId: string;
    key: string;
  } | null>(null);

  if (
    nextStepKey !== null &&
    (refresh?.investigationId !== investigationId || refresh.key !== nextStepKey)
  ) {
    // The first next step we see usually matches the investigation we already have,
    // unless it finished before that investigation was fetched.
    const missingRequest =
      orchestration?.report.nextStep?.status === 'completed' &&
      !getPrimaryActionRequest(actionRequests ?? [], orchestration.report.revision);
    setRefresh({
      detailUpdates,
      initial: refresh?.investigationId !== investigationId && !missingRequest,
      investigationId,
      key: nextStepKey,
    });
  }

  useEffect(() => {
    if (refresh && !refresh.initial) {
      void queryClient.invalidateQueries({
        queryKey: getInvestigationDetailQueryOptions(
          organization.slug,
          refresh.investigationId
        ).queryKey,
      });
    }
  }, [organization.slug, queryClient, refresh]);

  if (refresh === null || refresh.initial || nextStepKey === null) {
    return false;
  }
  return detailUpdates === refresh.detailUpdates;
}

const RECHECK_RUN_WAIT_MS = 60_000;

type RecheckRunWait = {pending: string[]; waiting: string[]};

/**
 * Seer can acknowledge a re-check before the investigation shows its run, and then
 * nothing would read the run again. Wait for the run only on re-checks this page saw
 * pending, since an old acknowledged follow-up stays on the request after it's over.
 */
function useRecheckRunWait(actionRequests: InvestigationActionRequest[] = []) {
  const [wait, setWait] = useState<RecheckRunWait>({pending: [], waiting: []});
  const acknowledged = new Set(
    actionRequests
      .filter(
        request =>
          request.state !== 'withdrawn' && request.followUp?.status === 'acknowledged'
      )
      .map(request => request.id)
  );
  const next: RecheckRunWait = {
    pending: actionRequests.filter(isFollowUpPending).map(request => request.id),
    waiting: [...new Set([...wait.waiting, ...wait.pending])].filter(id =>
      acknowledged.has(id)
    ),
  };
  if (
    next.pending.join() !== wait.pending.join() ||
    next.waiting.join() !== wait.waiting.join()
  ) {
    setWait(next);
  }
  const waitingKey = next.waiting.join();
  useEffect(() => {
    if (!waitingKey) {
      return;
    }
    const timer = setTimeout(
      () => setWait(current => ({...current, waiting: []})),
      RECHECK_RUN_WAIT_MS
    );
    return () => clearTimeout(timer);
  }, [waitingKey]);
  return {
    waiting: next.waiting.length > 0,
    stop: () => setWait(current => ({...current, waiting: []})),
  };
}

function isRunLive(orchestration: InvestigationOrchestration | undefined) {
  return orchestration !== undefined && shouldPollInvestigationRun(orchestration.status);
}

export function InvestigationBootstrapPage({investigationId}: {investigationId: string}) {
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const detailOptions = getInvestigationDetailQueryOptions(
    organization.slug,
    investigationId
  );
  // Seer Agent can write blocks, start their runs, and steer the investigation
  // from a chat on this page. Its writes go to routes under the investigation,
  // which the refresh after a Seer write doesn't tie to these queries, and a
  // settled investigation has stopped polling.
  const isSeerWorking = useSeerExplorerContext().sessionState === 'thinking';
  const {
    data: investigation,
    error,
    isError,
    isPending,
    refetch,
  } = useQuery({
    ...detailOptions,
    refetchInterval: query => {
      const data = query.state.data?.json;
      // A live agentic run keeps this polling too: the notebook fills in as the
      // agent writes blocks, and `orchestration` is what gates the hypothesis
      // row, so a stale copy would leave the row hidden or showing a run that
      // has since finished.
      const orchestrationActive =
        data?.orchestration && shouldPollInvestigationRun(data.orchestration.status);
      return isSeerWorking ||
        orchestrationActive ||
        data?.actionRequests?.some(isFollowUpPending) ||
        shouldPollInvestigationBlocks(data?.blocks ?? []) ||
        isTitleGenerationActive(data?.titleGeneration?.status)
        ? 2000
        : false;
    },
    refetchOnWindowFocus: query =>
      query.state.data?.json.actionRequests?.some(shouldRefreshOnFocus)
        ? 'always'
        : false,
  });

  const wasSeerWorking = useRef(isSeerWorking);
  useEffect(() => {
    if (wasSeerWorking.current && !isSeerWorking) {
      // Picks up what it wrote after the last poll, and a run it restarted.
      void refetch();
      void queryClient.invalidateQueries({
        queryKey: investigationOrchestrationQueryOptions(
          organization.slug,
          investigationId
        ).queryKey,
      });
    }
    wasSeerWorking.current = isSeerWorking;
  }, [investigationId, isSeerWorking, organization.slug, queryClient, refetch]);

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

function InvestigationPageContentInner({
  investigation,
}: {
  investigation: InvestigationDetail;
}) {
  const organization = useOrganization();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const {copy} = useCopyToClipboard();
  const composerRef = useRef<HTMLDivElement>(null);
  const activityRef = useRef<HTMLElement>(null);
  const {data: comments} = useInvestigationComments(investigation.id, {
    shouldPoll: investigation.status !== 'archived',
  });
  const commentCount = comments?.json.length ?? 0;
  const hasMoreComments =
    parseLinkHeader(comments?.headers.Link ?? null).next?.results === true;
  const isArchived = investigation.status === 'archived';
  const {data: commentCounts} = useQuery({
    ...investigationCommentCountsQueryOptions(organization.slug, investigation.id),
    refetchInterval: 10_000,
  });
  const {openBlockComments} = useBlockCommentsDrawer(investigation.id);
  const [draftTitle, setDraftTitle] = useState<string | null>(null);
  const persistedTitle = useRef(investigation.title);
  const titleGenerationSettledFor = useRef<string | null>(null);
  const detailOptions = getInvestigationDetailQueryOptions(
    organization.slug,
    investigation.id
  );
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
  const displayedTitle = draftTitle ?? generatedTitlePreview ?? investigation.title;
  const recheckRunWait = useRecheckRunWait(investigation.actionRequests);
  const {data: orchestration, isPending: orchestrationPending} = useQuery({
    ...investigationOrchestrationQueryOptions(organization.slug, investigation.id),
    enabled: Boolean(investigation.orchestration),
    refetchInterval: query =>
      (investigation.orchestration &&
        shouldPollInvestigationRun(investigation.orchestration.status)) ||
      isRunLive(query.state.data?.json) ||
      recheckRunWait.waiting
        ? 2000
        : false,
  });
  if (recheckRunWait.waiting && isRunLive(orchestration)) {
    recheckRunWait.stop();
  }
  const actionRequestsStale = useRefetchStaleActionRequests(
    investigation.id,
    orchestration,
    investigation.actionRequests
  );
  const runStatus =
    investigation.orchestration && orchestration
      ? getSeerStatusBlock(orchestration)
      : null;

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
      onError: () => addErrorMessage(t('Unable to rename investigation.')),
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
      navigate(getInvestigationsPath(organization.slug));
    },
    onError: () => addErrorMessage(t('Unable to delete investigation.')),
  });
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

  const visibleBlocks = (investigation.blocks ?? []).filter(block =>
    shouldDisplayInvestigationBlock(block)
  );
  const awaitingReportBlock = isAwaitingReportBlock(investigation);
  const runProcessing = isRunWorking(orchestration) || recheckRunWait.waiting;
  const hypothesisStatements = new Map(
    orchestration?.hypotheses.map(({id, statement}) => [id, statement])
  );
  const placedActionRequests = groupActionRequestsByPlacement(
    investigation.actionRequests ?? [],
    anchor => {
      if (anchor?.type === 'hypothesis' && investigation.orchestration) {
        if (orchestration) {
          return hypothesisStatements.has(anchor.id) ? 'hypotheses' : 'unplaced';
        }
        return orchestrationPending ? null : 'unplaced';
      }
      if (
        anchor?.type === 'block' &&
        visibleBlocks.some(({id}) => id === anchor.blockId)
      ) {
        return `block:${anchor.blockId}`;
      }
      return 'unplaced';
    }
  );
  const source = getInvestigationSource(investigation);
  const hasDetails =
    Boolean(investigation.orchestration) ||
    visibleBlocks.length > 0 ||
    awaitingReportBlock;
  const hasSummary = Boolean(investigation.summary && investigation.summaryDescription);
  // The "Investigation details" heading only appears below a summary.
  const showDetailsHeading = hasDetails && hasSummary;
  const showActivity = isInvestigationRunDone(investigation);
  // Push the investigation into the LLM context tree for Seer Explorer. Its
  // hypotheses and blocks register their own nodes beneath it.
  const {getLLMContext} = useLLMContext(
    getInvestigationLLMContext(investigation, orchestration),
    // Page context waits for the run, so its state and hypotheses come along.
    {isLoading: Boolean(investigation.orchestration) && orchestrationPending}
  );
  const askSeer = useInvestigationAskSeer();
  const askSeerAboutInvestigation = askSeer
    ? () =>
        askSeer({
          prompt: t('What would you like to know about this investigation?'),
          // This node with everything beneath it, so the hypotheses and blocks on
          // screen come along.
          context: getLLMContext(true).nodes[0],
        })
    : undefined;
  const askSeerAboutHypothesis = askSeer
    ? (hypothesis: InvestigationHypothesis) =>
        askSeer({
          prompt: t('What would you like to know about this hypothesis?'),
          context: {
            investigation: getInvestigationReference(investigation),
            hypothesis: getHypothesisLLMContext(
              hypothesis,
              hypothesis.id === orchestration?.report.primaryHypothesisId
            ),
          },
        })
    : undefined;
  const outline = getInvestigationOutline({
    blocks: visibleBlocks,
    hasActivity: showActivity,
    hasHypotheses: Boolean(
      investigation.orchestration && orchestration?.hypotheses.length
    ),
    hasSummary,
  });

  return (
    <SentryDocumentTitle title={displayedTitle} orgSlug={organization.slug}>
      <Stack flex={1}>
        <TopBar.Slot
          name="breadcrumbs"
          title={{
            type: 'page-title',
            label: displayedTitle,
            trailingActions: {
              type: 'menu',
              items: [
                ...(askSeerAboutInvestigation
                  ? [
                      {
                        key: 'ask-seer',
                        label: t('Ask Seer'),
                        onAction: askSeerAboutInvestigation,
                      },
                    ]
                  : []),
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
              ],
              triggerLabel: t('Investigation actions'),
              triggerIcon: <IconEllipsis />,
            },
          }}
          items={[
            {
              type: 'link',
              label: t('Investigations'),
              to: getInvestigationsPath(organization.slug),
              leadingGraphic: <IconStack size="md" />,
            },
          ]}
        />
        <Container as="header" width="100%" padding="xl xl 2xl">
          <Stack gap="xs" width="100%" maxWidth="960px" margin="0 auto">
            <Grid
              columns={runStatus ? 'minmax(0, 1fr) auto' : 'minmax(0, 1fr)'}
              align="center"
              gap="md"
            >
              <NotebookTitleInput
                aria-label={t('Investigation title')}
                value={displayedTitle}
                onChange={event => handleTitleChange(event.target.value)}
                onBlur={handleTitleBlur}
                maxLength={200}
                aria-busy={renameMutation.isPending}
              />
              {runStatus ? (
                <Flex align="center" gap="md" wrap="nowrap">
                  <Tag variant={STATUS_TAG_VARIANT[runStatus.variant]}>
                    {runStatus.statusLabel}
                  </Tag>
                  {orchestration ? (
                    <InvestigationRunTimer orchestration={orchestration} />
                  ) : null}
                </Flex>
              ) : null}
            </Grid>
            <Flex align="center" justify="between" gap="md">
              <Flex flex="1" minWidth={0} align="center" gap="sm" wrap="wrap">
                {source.groupId ? (
                  <Link
                    to={normalizeUrl(
                      `/organizations/${organization.slug}/issues/${source.groupId}/`
                    )}
                  >
                    <Flex as="span" align="center" gap="xs">
                      <IconIssues size="xs" />
                      {source.monitorName ?? t('View issue')}
                    </Flex>
                  </Link>
                ) : (
                  <Text variant="muted">
                    {formatSourceType(investigation.sourceType)}
                  </Text>
                )}
                <MetaDivider />
                <Text variant="muted">
                  {tct('Last update: [date]', {
                    date: <DateTime date={investigation.dateUpdated} year />,
                  })}
                </Text>
                {!showActivity ||
                (investigation.status === 'archived' && commentCount === 0) ? null : (
                  <Fragment>
                    <MetaDivider />
                    <Button
                      size="sm"
                      variant="link"
                      icon={<IconChat size="xs" />}
                      onClick={() => {
                        if (investigation.status === 'archived') {
                          activityRef.current?.scrollIntoView?.({behavior: 'smooth'});
                          return;
                        }
                        composerRef.current?.scrollIntoView?.({
                          block: 'center',
                          behavior: 'smooth',
                        });
                        composerRef.current?.focus({preventScroll: true});
                      }}
                    >
                      {hasMoreComments
                        ? t('%s+ comments', commentCount)
                        : commentCount > 0
                          ? tn('%s comment', '%s comments', commentCount)
                          : t('Comment')}
                    </Button>
                  </Fragment>
                )}
                <InvestigationViewers
                  investigationId={investigation.id}
                  separator={<MetaDivider />}
                />
              </Flex>
              <Container flexShrink={0}>
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
              </Container>
            </Flex>
          </Stack>
        </Container>
        <Layout.Body padding={{xl: '0 lg lg', '3xl': '0 xl lg'}}>
          <Layout.Main width="full">
            {/*
             * The report keeps to the middle column, as wide as the header above
             * it, which leaves the left one free for the outline.
             */}
            <Grid columns="minmax(0, 1fr) min(960px, 100%) minmax(0, 1fr)">
              {outline.length > 0 ? (
                <Container
                  column="1"
                  display={{zero: 'none', '5xl': 'block'}}
                  justifySelf="end"
                  width="100%"
                  maxWidth="264px"
                  paddingRight="2xl"
                >
                  <InvestigationOutline entries={outline} />
                </Container>
              ) : null}
              <Stack column="2" minWidth={0} gap="3xl">
                <InvestigationSummaryCard
                  id={SUMMARY_ELEMENT_ID}
                  summary={investigation.summary}
                  summaryDescription={investigation.summaryDescription}
                />
                <NextStepCard
                  actionRequests={investigation.actionRequests}
                  actionRequestsStale={actionRequestsStale}
                  investigationId={investigation.id}
                  source={investigation.source}
                  orchestration={orchestration}
                  orchestrationLoading={
                    Boolean(investigation.orchestration) && orchestrationPending
                  }
                  waitingOnRun={recheckRunWait.waiting}
                />
                <AnchoredActionRequests
                  actionRequests={placedActionRequests.get('unplaced')}
                  investigationId={investigation.id}
                  runProcessing={runProcessing}
                  source={investigation.source}
                />

                {showDetailsHeading ? <Separator orientation="horizontal" /> : null}

                {hasDetails ? (
                  <Stack gap="lg">
                    {showDetailsHeading ? (
                      <Heading as="h2" size="lg">
                        {t('Investigation details')}
                      </Heading>
                    ) : null}
                    <DetailsBody gap="3xl">
                      {/*
                       * Only an agentic investigation has hypotheses, and `orchestration`
                       * being present is the only thing that says one is: it is null for
                       * manual and template investigations, whose orchestration endpoint
                       * 404s.
                       */}
                      {investigation.orchestration ? (
                        <InvestigationHypotheses
                          id={HYPOTHESES_ELEMENT_ID}
                          investigationId={investigation.id}
                          phase={investigation.orchestration.phase}
                          status={investigation.orchestration.status}
                          onAskSeer={askSeerAboutHypothesis}
                        />
                      ) : null}
                      <AnchoredActionRequests
                        actionRequests={placedActionRequests.get('hypotheses')}
                        investigationId={investigation.id}
                        runProcessing={runProcessing}
                        source={investigation.source}
                        getLabel={anchor => {
                          const statement = anchor
                            ? hypothesisStatements.get(anchor.id)
                            : undefined;
                          return statement
                            ? tct('About the possible cause: [statement]', {statement})
                            : null;
                        }}
                      />
                      {visibleBlocks.length > 0 || awaitingReportBlock ? (
                        <Stack>
                          {visibleBlocks.map((block, index) => (
                            <Container
                              key={block.id}
                              paddingTop={getBlockSpacing(block, index)}
                            >
                              <InvestigationNotebookBlock
                                block={block}
                                canRun={investigation.status === 'active'}
                                investigation={investigation}
                                commentCount={commentCounts?.[block.id]}
                                onComment={
                                  isArchived && commentCounts && !commentCounts[block.id]
                                    ? undefined
                                    : openBlockComments
                                }
                              />
                              <AnchoredActionRequests
                                actionRequests={placedActionRequests.get(
                                  `block:${block.id}`
                                )}
                                investigationId={investigation.id}
                                runProcessing={runProcessing}
                                source={investigation.source}
                              />
                            </Container>
                          ))}
                          {awaitingReportBlock ? (
                            <Container
                              paddingTop={visibleBlocks.length > 0 ? '3xl' : '0'}
                            >
                              <InvestigationBlockPlaceholder />
                            </Container>
                          ) : null}
                        </Stack>
                      ) : null}
                    </DetailsBody>
                  </Stack>
                ) : null}
                {showActivity ? (
                  <InvestigationActivity
                    id={ACTIVITY_ELEMENT_ID}
                    investigation={investigation}
                    composerRef={composerRef}
                    ref={activityRef}
                  />
                ) : null}
                <Container height="128px" flexShrink={0} aria-hidden />
              </Stack>
            </Grid>
          </Layout.Main>
        </Layout.Body>
      </Stack>
    </SentryDocumentTitle>
  );
}

const InvestigationPageContent = registerLLMContext(
  'investigation',
  InvestigationPageContentInner
);

/**
 * Text blocks start a new section with a large gap. Query blocks sit close to the
 * text block above them.
 */
function getBlockSpacing(block: InvestigationBlock, index: number) {
  if (index === 0) {
    return '0';
  }
  return block.kind === 'query' ? 'lg' : '3xl';
}

// Seer reaches the reporting phase once it is done with the hypotheses, but the
// report arrives as blocks on a later poll. Until then the notebook stands in a
// placeholder block, unless a block is already running — that one shows its own.
function isAwaitingReportBlock(investigation: InvestigationDetail) {
  const {orchestration} = investigation;
  if (orchestration?.status !== 'processing' || orchestration.phase !== 'reporting') {
    return false;
  }
  // Only a block Seer is working on rules this out, because that block is already
  // showing a placeholder of its own. A block that finished, failed or was
  // cancelled is done, and more are still coming.
  return !(investigation.blocks ?? []).some(isBlockWorking);
}

// The activity feed waits for an agentic run to stop, so it doesn't compete with
// the run for attention while Seer is still working. Manual and template
// investigations have no run, so their feed always shows.
function isInvestigationRunDone(investigation: InvestigationDetail) {
  const {orchestration} = investigation;
  return !orchestration || RUN_DONE_STATUSES.has(orchestration.status);
}

const RUN_DONE_STATUSES = new Set<string>(['completed', 'failed', 'cancelled']);

function isTitleGenerationActive(status: string | null | undefined) {
  return status === 'pending' || status === 'running';
}

function formatSourceType(sourceType: string) {
  if (sourceType === 'metric_open_period') {
    return t('Breached metric');
  }
  if (sourceType === 'manual') {
    return t('Manual investigation');
  }
  return sourceType.replaceAll('_', ' ');
}

const NotebookTitleInput = styled(Input)`
  width: 100%;
  min-width: 0;
  max-width: 100%;
  height: auto;
  margin: 0;
  padding: 0;
  color: ${p => p.theme.tokens.content.primary};
  background: transparent;
  border-color: transparent;
  border-radius: ${p => p.theme.radius.sm};
  box-shadow: none;
  /* The base input's form min-height would pad the title out below its text. */
  min-height: 0;
  font-size: ${p => p.theme.font.size.xl};
  font-weight: ${p => p.theme.font.weight.sans.medium};
  line-height: 1.25;

  &:hover,
  &:focus {
    background: ${p => p.theme.tokens.background.secondary};
    border-color: ${p => p.theme.tokens.border.primary};
  }
`;

/**
 * Hidden when empty (e.g. no hypotheses and no blocks), so it doesn't add a gap
 * below the heading.
 */
const DetailsBody = styled(Stack)`
  &:empty {
    display: none;
  }
`;

const MetaDivider = styled('span')`
  height: 16px;
  border-left: 1px solid ${p => p.theme.tokens.border.primary};
`;

export default function InvestigationDetailView() {
  const organization = useOrganization();
  const investigationsEnabled = useInvestigationsEnabled();
  const {investigationId} = useParams<{investigationId: string}>();

  return (
    <AnalyticsArea name="investigations.details" overrideParent>
      <Feature
        organization={organization}
        features="organizations:investigations"
        renderDisabled={() => <FeatureDisabledPage />}
      >
        {investigationsEnabled ? (
          <InvestigationBootstrapPage investigationId={investigationId} />
        ) : (
          <ClosedMembershipPage />
        )}
      </Feature>
    </AnalyticsArea>
  );
}
