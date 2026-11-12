import {Fragment, useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {IconChat} from '@sentry/icons/chat';
import {IconIssues} from '@sentry/icons/issues';
import {useIsFetching, useQuery, useQueryClient} from '@tanstack/react-query';

import {Tag} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {Input} from '@sentry/scraps/input';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Separator} from '@sentry/scraps/separator';
import {Heading, Text} from '@sentry/scraps/text';

import {DateTime} from 'sentry/components/dateTime';
import * as Layout from 'sentry/components/layouts/thirds';
import {t, tct, tn} from 'sentry/locale';
import {parseLinkHeader} from 'sentry/utils/parseLinkHeader';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useOrganization} from 'sentry/utils/useOrganization';
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
  investigationOrchestrationQueryOptions,
  isFollowUpPending,
} from 'sentry/views/investigations/api';
import {useBlockCommentsDrawer} from 'sentry/views/investigations/comments/useBlockCommentsDrawer';
import {useInvestigationComments} from 'sentry/views/investigations/comments/useInvestigationComments';
import {
  InvestigationHypotheses,
  shouldPollInvestigationRun,
} from 'sentry/views/investigations/hypotheses/investigationHypotheses';
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
import {useLLMContext} from 'sentry/views/seerExplorer/contexts/llmContext';

import {
  InvestigationNotebookBlock,
  isBlockWorking,
  shouldDisplayInvestigationBlock,
} from './block';
import {InvestigationBlockPlaceholder} from './blockPlaceholder';
import {
  ACTIVITY_ELEMENT_ID,
  getInvestigationOutline,
  HYPOTHESES_ELEMENT_ID,
  InvestigationOutline,
  SUMMARY_ELEMENT_ID,
} from './outline';
import {InvestigationViewers} from './presence';
import {InvestigationRunTimer} from './runTimer';
import type {InvestigationTitle} from './useInvestigationTitle';

const STATUS_TAG_VARIANT = {
  running: 'info',
  awaitingInput: 'warning',
  failed: 'danger',
  complete: 'success',
  cancelled: 'muted',
} as const;

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

/**
 * The investigation notebook: its header, report, and activity. It reports to
 * the "investigation" node of the LLM context tree, which whoever renders it
 * registers around it.
 */
export function InvestigationPageContent({
  investigation,
  title,
}: {
  investigation: InvestigationDetail;
  title: InvestigationTitle;
}) {
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const composerRef = useRef<HTMLDivElement>(null);
  const activityRef = useRef<HTMLElement>(null);
  const {data: comments} = useInvestigationComments(investigation.id, {
    shouldPoll: investigation.status !== 'archived',
  });
  const commentCount = comments?.json.length ?? 0;
  const hasMoreComments =
    parseLinkHeader(comments?.headers.Link ?? null).next?.results === true;
  const commentsLabel = hasMoreComments
    ? t('%s+ comments', commentCount)
    : commentCount > 0
      ? tn('%s comment', '%s comments', commentCount)
      : t('Comment');
  const isArchived = investigation.status === 'archived';
  const {data: commentCounts} = useQuery({
    ...investigationCommentCountsQueryOptions(organization.slug, investigation.id),
    refetchInterval: 10_000,
  });
  const {openBlockComments} = useBlockCommentsDrawer(investigation.id);
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
  // A run waiting on a person stops this page polling, and answering it only
  // moves the projection. Once the run is past the wait, re-read the
  // investigation so the notebook polls again while Seer writes it.
  const runLeftAwaitingInput =
    investigation.orchestration?.status === 'awaiting_input' &&
    orchestration !== undefined &&
    orchestration.status !== 'awaiting_input';
  useEffect(() => {
    if (runLeftAwaitingInput) {
      void queryClient.invalidateQueries({
        queryKey: getInvestigationDetailQueryOptions(organization.slug, investigation.id)
          .queryKey,
      });
    }
  }, [investigation.id, organization.slug, queryClient, runLeftAwaitingInput]);
  const actionRequestsStale = useRefetchStaleActionRequests(
    investigation.id,
    orchestration,
    investigation.actionRequests
  );
  const runStatus =
    investigation.orchestration && orchestration
      ? getSeerStatusBlock(orchestration)
      : null;

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
  useLLMContext(
    getInvestigationLLMContext(investigation, orchestration),
    // Page context waits for the run, so its state and hypotheses come along.
    {isLoading: Boolean(investigation.orchestration) && orchestrationPending}
  );
  const askSeer = useInvestigationAskSeer();
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
  const askSeerAboutHypotheses = askSeer
    ? (hypotheses: InvestigationHypothesis[]) =>
        askSeer({
          prompt: t('What would you like to know about these hypotheses?'),
          context: {
            investigation: getInvestigationReference(investigation),
            hypotheses: hypotheses.map(hypothesis =>
              getHypothesisLLMContext(
                hypothesis,
                hypothesis.id === orchestration?.report.primaryHypothesisId
              )
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
    <Stack flex={1}>
      <Container as="header" width="100%" padding="xl xl 2xl">
        <Stack gap="xs" width="100%" maxWidth="960px" margin="0 auto">
          <Grid
            columns={runStatus ? 'minmax(0, 1fr) auto' : 'minmax(0, 1fr)'}
            align="center"
            gap="md"
          >
            <NotebookTitleInput
              aria-label={t('Investigation title')}
              value={title.displayedTitle}
              onChange={event => title.onChange(event.target.value)}
              onBlur={title.onBlur}
              maxLength={200}
              aria-busy={title.isSaving}
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
          <Flex minWidth={0} align="center" gap="sm" wrap="wrap">
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
              <Text variant="muted">{formatSourceType(investigation.sourceType)}</Text>
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
                  aria-label={commentsLabel}
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
                  <CommentCount>
                    {hasMoreComments ? `${commentCount}+` : commentCount}
                  </CommentCount>
                </Button>
              </Fragment>
            )}
            <InvestigationViewers
              investigationId={investigation.id}
              separator={<MetaDivider />}
            />
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
                display={{zero: 'none', '4xl': 'block'}}
                justifySelf="end"
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
                        onAskSeerAboutHypotheses={askSeerAboutHypotheses}
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
                          <Container paddingTop={visibleBlocks.length > 0 ? '3xl' : '0'}>
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
  );
}

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

/**
 * Digits have no descenders, so the line box's descender room pushes a
 * centered number above the icon. Trimming to the cap height and baseline
 * centers the glyphs themselves.
 */
const CommentCount = styled('span')`
  text-box-edge: cap alphabetic;
  text-box-trim: trim-both;
`;
