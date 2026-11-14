import {useEffect, useMemo, useRef, type ComponentType, type ReactNode} from 'react';
import {IconBug} from '@sentry/icons/bug';
import {IconCode} from '@sentry/icons/code';
import {IconList} from '@sentry/icons/list';
import {IconOpen} from '@sentry/icons/open';
import {IconPullRequest} from '@sentry/icons/pullRequest';
import type {SVGIconProps} from '@sentry/icons/svgIcon';
import {useIsFetching, useQueryClient} from '@tanstack/react-query';

import {Button, LinkButton} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Markdown, type MarkdownProps} from '@sentry/scraps/markdown';
import {Text} from '@sentry/scraps/text';

import {useAutofixCreditCheck} from 'sentry/components/events/autofix/autofixCredits';
import {
  getRepoPullRequestLink,
  hasCreatedPullRequests,
} from 'sentry/components/events/autofix/pullRequests';
import {
  collectPatches,
  explorerAutofixApiOptions,
  getAutofixArtifactFromSection,
  getOrderedAutofixSections,
  isCodeChangesArtifact,
  isLastStepPrIteration,
  isOutOfCreditsSection,
  isPrIterationBlock,
  isPullRequestsArtifact,
  isPullRequestsSection,
  isCodeChangesSection,
  isRootCauseArtifact,
  isSingleRunAutofix,
  isSolutionArtifact,
  useExplorerAutofix,
  type AutofixExplorerStep,
  type AutofixSection,
  type SolutionStep,
} from 'sentry/components/events/autofix/useExplorerAutofix';
import {useRefreshAutofixProgressQueries} from 'sentry/components/events/autofix/useRefreshAutofixProgressQueries';
import {ArtifactDetails} from 'sentry/components/events/autofix/v3/artifactDetails';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {
  useAutofixChat,
  useReportAutofixOutOfCredits,
} from 'sentry/components/seer/autofixChatContext';
import {defineSeerEmbed} from 'sentry/components/seer/markdown/embeds/utils';
import {
  getOutOfCreditsPRsMessage,
  OUT_OF_CREDITS_RETRY_TOOLTIP,
  OUT_OF_CREDITS_STEP_MESSAGE,
} from 'sentry/components/seer/outOfCredits/messages';
import {SeerOutOfCreditsCta} from 'sentry/components/seer/outOfCredits/seerOutOfCreditsCta';
import {useOutOfCreditsRetry} from 'sentry/components/seer/outOfCredits/useOutOfCreditsRetry';
import {t, tn} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import {defined} from 'sentry/utils/defined';
import {useAutoScroll} from 'sentry/utils/useAutoScroll';
import {useOrganization} from 'sentry/utils/useOrganization';
import {FileDiffViewer} from 'sentry/views/seerExplorer/components/fileDiffViewer';
import {isOutOfCreditsPRState, isSeerErrorBlock} from 'sentry/views/seerExplorer/types';

import {resourceLinkMarkdown} from './resourceLink';
import {SeerEmbedBlock} from './seerEmbedBlock';

/**
 * The autofix API reports steps by identifier; only the UI spells them out.
 */
export const STEP_LABELS: Record<AutofixExplorerStep, string> = {
  root_cause: t('Root Cause'),
  solution: t('Plan'),
  code_changes: t('Code Changes'),
  pr_iteration: t('Pull Request'),
};

/**
 * The step's title, which is all that survives as text -- progress, the buttons
 * and the body are why you would look at the embed instead. A string because it
 * is composed into a larger line, and there is no icon here for a `ResourceLink`.
 */
function autofixStepMarkdown(
  step: AutofixExplorerStep,
  id: string,
  shortId: string
): string {
  const issue = resourceLinkMarkdown(`/issues/${id}/`, shortId);
  return issue ? `${STEP_LABELS[step]}: ${issue}` : STEP_LABELS[step];
}

const STEP_ICONS: Record<AutofixExplorerStep, ComponentType<SVGIconProps>> = {
  root_cause: IconBug,
  solution: IconList,
  code_changes: IconCode,
  pr_iteration: IconPullRequest,
};

interface AutofixBlockProps extends Pick<Group, 'id' | 'shortId'> {
  children: ReactNode;
  step: AutofixExplorerStep;
}

/**
 * The shared block shell autofix embeds render into, with a link back to the
 * issue and arbitrary step content below.
 */
function AutofixBlock({id, shortId, step, children}: AutofixBlockProps) {
  const organization = useOrganization();
  return (
    <SeerEmbedBlock
      defaultExpanded={false}
      href={`/organizations/${organization.slug}/issues/${id}/`}
      icon={STEP_ICONS[step]}
      linkLabel={shortId}
      testId="seer-autofix-embed"
      title={STEP_LABELS[step]}
    >
      {children}
    </SeerEmbedBlock>
  );
}

interface AutofixContentProps extends Pick<Group, 'id' | 'shortId'> {
  /**
   * Markdown write-up for this step. Assembled by Seer rather than returned
   * verbatim by the autofix API, so it keeps a UI-facing name.
   */
  result: string;
  step: AutofixExplorerStep;
  fiveWhys?: string[];
  reproductionSteps?: string[];
  steps?: SolutionStep[];
}

/**
 * The structured fields are optional because Seer writes this embed itself
 * rather than echoing back run state, so a step can arrive as the write-up
 * alone. Missing detail collapses to the summary rather than an empty section.
 */
const AUTOFIX_MARKDOWN_COMPONENTS: MarkdownProps['components'] = {
  Paragraph: ({children}) => (
    <Text as="p" size="md" density="comfortable" wordBreak="break-all">
      {children}
    </Text>
  ),
};

function AutofixMarkdown({raw}: {raw: string}) {
  return <Markdown raw={raw} components={AUTOFIX_MARKDOWN_COMPONENTS} />;
}

function AutofixStepBody({
  fiveWhys,
  reproductionSteps,
  result,
  step,
  steps,
}: Omit<AutofixContentProps, 'id' | 'shortId'>) {
  if (step === 'root_cause') {
    return (
      <RootCauseBody
        description={result}
        fiveWhys={fiveWhys ?? []}
        reproductionSteps={reproductionSteps}
      />
    );
  }

  if (step === 'solution') {
    return <SolutionBody summary={result} steps={steps ?? []} />;
  }

  return <AutofixMarkdown raw={result} />;
}

export const Autofix = defineSeerEmbed({
  name: 'autofix',
  render({id, shortId, ...content}: AutofixContentProps, level) {
    switch (level) {
      case 'markdown':
        return autofixStepMarkdown(content.step, id, shortId);
      case 'block':
      case 'inline':
        return (
          <AutofixBlock id={id} shortId={shortId} step={content.step}>
            <AutofixStepBody {...content} />
          </AutofixBlock>
        );
    }
  },
});

const PROCESSING_TEXT: Record<AutofixExplorerStep, string> = {
  root_cause: t('Finding the root cause…'),
  solution: t('Formulating a plan…'),
  code_changes: t('Implementing changes…'),
  pr_iteration: t('Opening a pull request…'),
};

const ERROR_TEXT: Record<AutofixExplorerStep, string> = {
  root_cause: t('Seer failed to generate a root cause. This one is on us.'),
  solution: t('Seer failed to generate a plan. This one is on us.'),
  code_changes: t('Seer failed to generate code changes. This one is on us.'),
  pr_iteration: t('Seer failed to open a pull request. This one is on us.'),
};

/**
 * The step to continue to once the given step completes. `code_changes` has no
 * entry — its completion offers "Draft a pull request" instead, a different
 * action. `pr_iteration` has no next step; it's the end of the line.
 */
export const NEXT_STEP: Partial<Record<AutofixExplorerStep, AutofixExplorerStep>> = {
  root_cause: 'solution',
  solution: 'code_changes',
};

interface AutofixRefContentProps extends Pick<Group, 'id' | 'shortId'> {
  runId: string | number;
  step: AutofixExplorerStep;
}

/**
 * Refreshes the pages behind the chat panel once this step's result lands.
 *
 * Watches the section identity as well as its status. A `pr_iteration` embed
 * resolves to the code_changes section until a PR exists, then swaps to the
 * pull_request one; both report `completed`, so a status-only dependency would
 * sit still through the swap — the moment the PR badge actually has news.
 *
 * Refires for a run that was already finished when the embed mounted, so
 * reopening a chat history refreshes once per step it renders. That extra
 * refetch is worth accepting: the embed can't tell which page is behind it, let
 * alone whether that page has fetched anything since the run started.
 */
function useRefreshOnStepResult(groupId: string, section: AutofixSection | undefined) {
  const refreshAutofixProgressQueries = useRefreshAutofixProgressQueries(groupId);
  const {step, status} = section ?? {};

  useEffect(() => {
    if (status === 'completed') {
      refreshAutofixProgressQueries();
    }
    // oxlint-disable-next-line react/exhaustive-effect-dependencies
  }, [step, status, refreshAutofixProgressQueries]);
}

/**
 * Re-reads the run state once the agent stops working.
 *
 * The agent starts and finishes steps through the backend, and an idle run arms
 * no poll to notice — so without this the embeds keep showing the run as it was
 * before the agent touched it. Every embed for the issue shares the one query,
 * so they refetch once between them.
 */
function useRefetchRunStateWhenAgentSettles(groupId: string, isBusy: boolean) {
  const queryClient = useQueryClient();
  const organization = useOrganization();
  const wasBusy = useRef(isBusy);

  useEffect(() => {
    if (wasBusy.current && !isBusy) {
      queryClient.invalidateQueries({
        queryKey: explorerAutofixApiOptions(organization.slug, groupId).queryKey,
      });
    }
    wasBusy.current = isBusy;
  }, [groupId, isBusy, organization.slug, queryClient]);
}

function AutofixRefContent({id, shortId, step}: AutofixRefContentProps) {
  const organization = useOrganization();
  const autofix = useExplorerAutofix({id, shortId});
  const {runState, isLoading, isPolling} = autofix;
  const {isBusy, sendMessage} = useAutofixChat();
  const isRefetching =
    useIsFetching({
      queryKey: explorerAutofixApiOptions(organization.slug, id).queryKey,
    }) > 0;

  const sections = useMemo(() => getOrderedAutofixSections(runState), [runState]);
  const section = useMemo(() => findStepSection(sections, step), [sections, step]);

  useRefreshOnStepResult(id, section);
  useRefetchRunStateWhenAgentSettles(id, !!isBusy);

  const handleRetry = () => {
    sendMessage?.(t('Retry the %s step for %s.', STEP_LABELS[step], shortId));
  };

  const handleContinue = (nextStep: AutofixExplorerStep) => {
    sendMessage?.(t('Continue to the %s step for %s.', STEP_LABELS[nextStep], shortId));
  };

  const handleCreatePR = () => {
    sendMessage?.(t('Draft a pull request for %s.', shortId));
  };

  /**
   * A conversation can hold several embeds of the same step. Offering work
   * based on whether the run already contains it, rather than on this embed's
   * own section, is what keeps those copies agreeing — and stops a step being
   * offered again once it has run.
   */
  // A single run goes from root cause to code changes on its own, so it never
  // offers a next step.
  const nextStep = isSingleRunAutofix(runState ?? null) ? undefined : NEXT_STEP[step];
  const pendingNextStep =
    nextStep && !findStepSection(sections, nextStep) ? nextStep : undefined;
  // A failed create also lands in `repo_pr_states`; that one should stay retryable.
  const canCreatePR =
    step === 'code_changes' && !hasCreatedPullRequests(runState?.repo_pr_states);

  // A step or PR that stopped for credits fails the same way until the
  // organization can afford it again, so its retry waits for the credit check.
  const outOfCreditsSection =
    section && isOutOfCreditsSection(section) ? section : undefined;
  const stepRetry = useOutOfCreditsRetry(
    outOfCreditsSection ? getStoppedStep(outOfCreditsSection, step) : step,
    {enabled: defined(outOfCreditsSection)}
  );
  // Draft a pull request retries a create that failed for credits. The credit
  // check below holds it back like any other create; this only explains why.
  const prFailedForCredits = Object.values(runState?.repo_pr_states ?? {}).some(
    isOutOfCreditsPRState
  );

  const showsNextAction =
    section?.status === 'completed' && (canCreatePR || !!pendingNextStep);
  const creditCheck = useAutofixCreditCheck(canCreatePR ? 'create_pr' : pendingNextStep, {
    // A read-only conversation offers nothing to pay for.
    enabled: showsNextAction && !!sendMessage,
  });

  /**
   * The run state lags the agent, so it cannot gate these alone. `isBusy`
   * covers the agent working on a step that `isPolling` has not seen yet, and
   * `isRefetching` covers the round trip after it settles, while the cached
   * state still offers the step it just started.
   */
  const canAct = !!sendMessage && !isPolling && !isBusy && !isRefetching;
  // Held disabled until this mount's check answers, so a button is never
  // clickable before the answer arrives, even with an earlier one cached, and
  // while the org can't afford the step.
  const canContinue =
    canAct && creditCheck.hasCheckedSinceMount && creditCheck.hasEnoughCredits;
  // In the Explorer chat the notice sits above the composer, where it stays in
  // view as the chat scrolls. Anywhere else the card shows its own.
  const showsOutOfCreditsNotice = useReportAutofixOutOfCredits(
    showsNextAction && !creditCheck.hasEnoughCredits,
    creditCheck.denialReason
  );

  // Once a PR exists this embed shows the PR section, so an iteration that ran
  // out of credits is only visible on the code_changes section it folds into.
  const codeChangesSection = sections.find(isCodeChangesSection);
  const iterationOutOfCredits =
    step === 'pr_iteration' &&
    !!codeChangesSection &&
    isOutOfCreditsSection(codeChangesSection) &&
    isLastStepPrIteration(runState);

  return (
    <AutofixBlock id={id} shortId={shortId} step={step}>
      <Stack gap="lg">
        <AutofixRefBody
          isLoading={isLoading}
          section={section}
          step={step}
          iterationOutOfCredits={iterationOutOfCredits}
        />
        {section?.status === 'error' && (
          <Flex>
            <Button
              size="sm"
              onClick={handleRetry}
              disabled={!canAct || stepRetry.disabled}
              tooltipProps={{title: stepRetry.tooltip}}
            >
              {t('Try again')}
            </Button>
          </Flex>
        )}
        {/* Muted: the buttons it explains stay right below it. */}
        {showsOutOfCreditsNotice && (
          <SeerOutOfCreditsCta
            reason="autofix-continue"
            denialReason={creditCheck.denialReason}
            variant="muted"
          />
        )}
        {showsNextAction && (
          <Flex gap="sm">
            {canCreatePR && (
              <Button
                size="sm"
                variant="primary"
                onClick={handleCreatePR}
                disabled={!canContinue}
                tooltipProps={{
                  title:
                    prFailedForCredits && !creditCheck.hasEnoughCredits
                      ? OUT_OF_CREDITS_RETRY_TOOLTIP
                      : undefined,
                }}
              >
                {t('Draft a pull request')}
              </Button>
            )}
            {pendingNextStep && (
              <Button
                size="sm"
                variant="primary"
                onClick={() => handleContinue(pendingNextStep)}
                disabled={!canContinue}
              >
                {t('Continue: %s', STEP_LABELS[pendingNextStep])}
              </Button>
            )}
          </Flex>
        )}
      </Stack>
    </AutofixBlock>
  );
}

interface AutofixRefBodyProps {
  isLoading: boolean;
  step: AutofixExplorerStep;
  iterationOutOfCredits?: boolean;
  section?: AutofixSection;
}

function AutofixRefBody({
  isLoading,
  iterationOutOfCredits,
  section,
  step,
}: AutofixRefBodyProps) {
  if (isLoading || !section || section.status === 'processing') {
    return (
      <Flex gap="md" align="center">
        <LoadingIndicator size={16} style={{margin: 0}} />
        <Text variant="muted">{PROCESSING_TEXT[step]}</Text>
      </Flex>
    );
  }

  if (isOutOfCreditsSection(section)) {
    return <OutOfCreditsStepBody section={section} step={step} />;
  }

  if (section.status === 'error') {
    return <Text variant="danger">{ERROR_TEXT[step]}</Text>;
  }

  if (isPullRequestsSection(section)) {
    const artifact = getAutofixArtifactFromSection(section);
    const pullRequests = isPullRequestsArtifact(artifact) ? artifact : [];
    const links = pullRequests.map(getRepoPullRequestLink).filter(link => link !== null);
    // The PR section never reads as errored, so a create or push that ran out
    // of credits only shows on its repo's state.
    const outOfCreditsPullRequests = pullRequests.filter(isOutOfCreditsPRState);
    let outOfCreditsStatus: ReactNode = null;
    if (outOfCreditsPullRequests.length > 0) {
      outOfCreditsStatus = (
        <Text variant="danger">
          {getOutOfCreditsPRsMessage(outOfCreditsPullRequests)}
        </Text>
      );
    } else if (iterationOutOfCredits) {
      outOfCreditsStatus = (
        <Text variant="danger">{OUT_OF_CREDITS_STEP_MESSAGE.pr_iteration}</Text>
      );
    }

    if (!links.length) {
      return outOfCreditsStatus ?? <Text variant="muted">{ERROR_TEXT.pr_iteration}</Text>;
    }

    return (
      <Stack gap="lg">
        <Flex gap="sm" wrap="wrap">
          {links.map(link => (
            <LinkButton
              key={link.url}
              size="sm"
              icon={<IconOpen />}
              href={link.url}
              external
            >
              {link.label}
            </LinkButton>
          ))}
        </Flex>
        {outOfCreditsStatus}
      </Stack>
    );
  }

  const artifact = getAutofixArtifactFromSection(section);

  if (step === 'root_cause' && isRootCauseArtifact(artifact) && artifact.data) {
    return (
      <RootCauseBody
        description={artifact.data.one_line_description}
        fiveWhys={artifact.data.five_whys}
        reproductionSteps={artifact.data.reproduction_steps}
      />
    );
  }

  if (step === 'solution' && isSolutionArtifact(artifact) && artifact.data) {
    return (
      <SolutionBody
        summary={artifact.data.one_line_summary}
        steps={artifact.data.steps}
      />
    );
  }

  if (isCodeChangesArtifact(artifact)) {
    const patchesByRepo = collectPatches(artifact);
    if (patchesByRepo.size > 0) {
      return <CodeChangesBody patchesByRepo={patchesByRepo} />;
    }
  }

  return <Text variant="muted">{ERROR_TEXT[step]}</Text>;
}

/**
 * The blocks of the step a section stopped in. A code_changes section also
 * holds every PR iteration, and only the one that stopped is relevant.
 */
function getStoppedStepBlocks(section: AutofixSection): AutofixSection['blocks'] {
  const stepStart = section.blocks.findLastIndex(block =>
    defined(block.message.metadata?.step)
  );
  return section.blocks.slice(Math.max(stepStart, 0));
}

/**
 * The step a section stopped in: a code_changes section can stop in a PR
 * iteration.
 */
function getStoppedStep(
  section: AutofixSection,
  step: AutofixExplorerStep
): AutofixExplorerStep {
  if (!isCodeChangesSection(section)) {
    return step;
  }
  const firstBlock = getStoppedStepBlocks(section)[0];
  return firstBlock && isPrIterationBlock(firstBlock) ? 'pr_iteration' : 'code_changes';
}

function hasText(content: string | null | undefined): content is string {
  const trimmed = content?.trim();
  return !!trimmed && trimmed !== '.';
}

/**
 * What a stopped step wrote, without Seer's own error block, since the line
 * below says why it stopped. It renders with this embed's markdown rather than
 * `ArtifactPartialDetails`, whose `SeerMarkdown` renders embeds and so would
 * import this file back.
 */
function StoppedStepText({blocks}: {blocks: AutofixSection['blocks']}) {
  const {containerRef, onScrollHandler} = useAutoScroll({key: blocks});
  const texts = blocks.flatMap(block => {
    if (block.message.role === 'user' || isSeerErrorBlock(block)) {
      return [];
    }
    const {content, thinking_content} = block.message;
    if (hasText(content) && content !== 'Thinking...') {
      return [content];
    }
    return hasText(thinking_content) ? [thinking_content] : [];
  });

  if (texts.length === 0) {
    return null;
  }

  return (
    <ArtifactDetails>
      <Stack
        gap="md"
        ref={containerRef}
        maxHeight="200px"
        overflowY="auto"
        onScroll={onScrollHandler}
      >
        {texts.map((text, index) => (
          <AutofixMarkdown key={index} raw={text} />
        ))}
      </Stack>
    </ArtifactDetails>
  );
}

/**
 * A step that stopped for credits: what it wrote and, for code changes, the
 * diff it got to, then a line saying why it stopped. The credit gates show the
 * CTA to add credits, so this has none of its own.
 */
function OutOfCreditsStepBody({
  section,
  step,
}: {
  section: AutofixSection;
  step: AutofixExplorerStep;
}) {
  const partialPatches = section.artifacts.findLast(isCodeChangesArtifact);
  const patchesByRepo = collectPatches(partialPatches ?? []);

  return (
    <Stack gap="lg">
      <StoppedStepText blocks={getStoppedStepBlocks(section)} />
      {patchesByRepo.size > 0 && <CodeChangesBody patchesByRepo={patchesByRepo} />}
      <Text variant="danger">
        {OUT_OF_CREDITS_STEP_MESSAGE[getStoppedStep(section, step)]}
      </Text>
    </Stack>
  );
}

interface RootCauseBodyProps {
  description: string;
  fiveWhys: string[];
  reproductionSteps?: string[];
}

function RootCauseBody({description, fiveWhys, reproductionSteps}: RootCauseBodyProps) {
  return (
    <Stack gap="lg">
      <AutofixMarkdown raw={description} />
      {fiveWhys.length > 0 && (
        <ArtifactDetails>
          <Text bold>{t('Why did this happen?')}</Text>
          <Stack as="ul" gap="md" margin="0">
            {fiveWhys.map((why, index) => (
              <li key={index}>
                <AutofixMarkdown raw={why} />
              </li>
            ))}
          </Stack>
        </ArtifactDetails>
      )}
      {reproductionSteps && reproductionSteps.length > 0 && (
        <ArtifactDetails>
          <Text bold>{t('Reproduction Steps')}</Text>
          <Stack as="ol" gap="md" margin="0">
            {reproductionSteps.map((step, index) => (
              <li key={index}>
                <AutofixMarkdown raw={step} />
              </li>
            ))}
          </Stack>
        </ArtifactDetails>
      )}
    </Stack>
  );
}

interface SolutionBodyProps {
  steps: SolutionStep[];
  summary: string;
}

function SolutionBody({steps, summary}: SolutionBodyProps) {
  return (
    <Stack gap="lg">
      <AutofixMarkdown raw={summary} />
      {steps.length > 0 && (
        <ArtifactDetails>
          <Text bold>{t('Steps to Resolve')}</Text>
          <Stack as="ol" gap="md" margin="0">
            {steps.map((step, index) => (
              <li key={index}>
                <Stack>
                  <AutofixMarkdown raw={step.title} />
                  <Text size="sm" variant="muted" wordBreak="break-all">
                    {step.description}
                  </Text>
                </Stack>
              </li>
            ))}
          </Stack>
        </ArtifactDetails>
      )}
    </Stack>
  );
}

interface CodeChangesBodyProps {
  patchesByRepo: ReturnType<typeof collectPatches>;
}

function CodeChangesBody({patchesByRepo}: CodeChangesBodyProps) {
  return (
    <Stack gap="lg">
      <Text>{summarizeCodeChanges(patchesByRepo)}</Text>
      {Array.from(patchesByRepo.entries(), ([repo, repoPatches]) => (
        <ArtifactDetails key={repo}>
          <Flex gap="lg">
            <Text bold>{t('Repository:')}</Text>
            <Text>{repo}</Text>
          </Flex>
          {repoPatches.map((patch, index) => (
            <FileDiffViewer
              key={index}
              patch={patch.patch}
              fileUrl={patch.code_url}
              showBorder
              collapsible
              defaultExpanded={repoPatches.length <= 1}
            />
          ))}
        </ArtifactDetails>
      ))}
    </Stack>
  );
}

function findStepSection(
  sections: AutofixSection[],
  step: AutofixExplorerStep
): AutofixSection | undefined {
  if (step === 'pr_iteration') {
    return sections.find(isPullRequestsSection) ?? sections.find(isCodeChangesSection);
  }
  return sections.find(s => s.step === step);
}

function summarizeCodeChanges(patchesByRepo: ReturnType<typeof collectPatches>): string {
  const filesChanged = new Set<string>();
  for (const [repoName, patches] of patchesByRepo) {
    for (const patch of patches) {
      filesChanged.add(`${repoName}:${patch.patch.path}`);
    }
  }

  if (patchesByRepo.size === 1) {
    return tn(
      '%s file changed in 1 repo',
      '%s files changed in 1 repo',
      filesChanged.size
    );
  }
  return t('%s files changed in %s repos', filesChanged.size, patchesByRepo.size);
}

export const AutofixRef = defineSeerEmbed({
  name: 'autofixRef',
  render(props, level) {
    switch (level) {
      case 'markdown':
        return autofixStepMarkdown(props.step, props.id, props.shortId);
      case 'block':
      case 'inline':
        return <AutofixRefContent {...props} />;
    }
  },
});
