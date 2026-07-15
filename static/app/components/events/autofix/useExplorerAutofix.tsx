import {useCallback, useRef, useState} from 'react';
import {useQuery, useQueryClient} from '@tanstack/react-query';

import {useModal} from '@sentry/scraps/modal';

import {
  addErrorMessage,
  addLoadingMessage,
  clearIndicators,
} from 'sentry/actionCreators/indicator';
import {AutofixCursorGithubAccessModal} from 'sentry/components/events/autofix/autofixCursorGithubAccessModal';
import {AutofixGithubAppPermissionsModal} from 'sentry/components/events/autofix/autofixGithubAppPermissionsModal';
import {AutofixGithubCopilotPurchaseModal} from 'sentry/components/events/autofix/autofixGithubCopilotPurchaseModal';
import {CodingAgentStatus} from 'sentry/components/events/autofix/types';
import {
  needsGitHubAuth,
  type CodingAgentIntegration,
} from 'sentry/components/events/autofix/useAutofix';
import {useServiceWorker} from 'sentry/serviceWorker/client/serviceWorkerContext';
import type {Group} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import type {User} from 'sentry/types/user';
import {isArrayOf, isString} from 'sentry/types/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {defined} from 'sentry/utils/defined';
import {getGithubPermissionsUpdateUrl} from 'sentry/utils/integrationUtil';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useApi} from 'sentry/utils/useApi';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';
import {
  isArtifact,
  isExplorerCodingAgentState,
  isExplorerFilePatch,
  isRepoPRState,
  type Artifact,
  type Block,
  type ExplorerCodingAgentState,
  type ExplorerFilePatch,
  type RepoPRState,
} from 'sentry/views/seerExplorer/types';

/**
 * Available autofix steps that can be triggered via the Explorer.
 */
interface CodingAgentError {
  id: number;
  message: string;
}

export type AutofixExplorerStep =
  | 'root_cause'
  | 'solution'
  | 'code_changes'
  | 'pr_iteration';

/**
 * Artifact data types matching the backend Pydantic schemas.
 */
export interface RootCauseArtifact {
  five_whys: string[];
  one_line_description: string;
  reproduction_steps?: string[];
}

export function isRootCauseArtifact(
  value: unknown
): value is Artifact<RootCauseArtifact> {
  if (!isArtifact(value)) {
    return false;
  }
  const data = value.data;
  if (data === null || typeof data !== 'object') {
    return false;
  }
  return (
    isString(data.one_line_description) &&
    isArrayOf(data.five_whys, isString) &&
    (!defined(data.reproduction_steps) || isArrayOf(data.reproduction_steps, isString))
  );
}

interface SolutionStep {
  description: string;
  title: string;
}

function isSolutionStep(value: unknown): value is SolutionStep {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return isString(obj.title) && isString(obj.description);
}

export interface SolutionArtifact {
  one_line_summary: string;
  steps: SolutionStep[];
}

export function isSolutionArtifact(value: unknown): value is Artifact<SolutionArtifact> {
  if (!isArtifact(value)) {
    return false;
  }
  const data = value.data;
  if (data === null || typeof data !== 'object') {
    return false;
  }
  return isString(data.one_line_summary) && isArrayOf(data.steps, isSolutionStep);
}

export function isCodeChangesArtifact(value: unknown): value is ExplorerFilePatch[] {
  return isArrayOf(value, isExplorerFilePatch) && value.length > 0;
}

export function isPullRequestsArtifact(value: unknown): value is RepoPRState[] {
  return isArrayOf(value, isRepoPRState) && value.length > 0;
}

export function isCodingAgentsArtifact(
  value: unknown
): value is ExplorerCodingAgentState[] {
  return isArrayOf(value, isExplorerCodingAgentState) && value.length > 0;
}

/**
 * State returned from the Explorer autofix endpoint.
 * This extends the SeerExplorer types with autofix-specific data.
 */
/**
 * Feedback source wire types, mirroring the pydantic discriminated union in
 * `src/sentry/seer/autofix/pr_iteration/types.py` (`FeedbackSource`). Each
 * member is keyed by `type`; narrow on it before reading member fields.
 */
interface UserUiFeedbackSource {
  type: 'user-ui';
  user?: User;
  user_feedback?: string;
  user_id?: number;
}

interface GithubPrCommentFeedbackSource {
  type: 'github-pr-comment';
  comment?: {html_url?: string; user?: {login: string}};
}

type RawFeedbackSource = UserUiFeedbackSource | GithubPrCommentFeedbackSource;

export interface RawFeedback {
  text: string;
  source?: RawFeedbackSource;
  timestamp?: string;
  // Short display label derived from the source, serialized on `Feedback`.
  ui_text?: string;
}

export interface ExplorerAutofixState {
  blocks: Block[];
  run_id: number;
  status: 'processing' | 'completed' | 'error' | 'awaiting_user_input';
  updated_at: string;
  coding_agents?: Record<string, ExplorerCodingAgentState>;
  pending_user_input?: {
    data: Record<string, unknown>;
    id: string;
    input_type: 'file_change_approval' | 'ask_user_question';
  } | null;
  queued_feedback?: RawFeedback[];
  repo_pr_states?: Record<string, RepoPRState>;
  warnings?: Array<{
    warning_type: string;
    installation_id?: string;
    repo_name?: string;
  }>;
}

/**
 * Response from the autofix endpoint.
 */
interface ExplorerAutofixResponse {
  autofix: ExplorerAutofixState | null;
}

const POLL_INTERVAL = 1000;

function explorerAutofixApiOptions(orgSlug: string, groupId: string) {
  return apiOptions.as<ExplorerAutofixResponse>()(
    '/organizations/$organizationIdOrSlug/issues/$issueId/autofix/',
    {
      path: {organizationIdOrSlug: orgSlug, issueId: groupId},
      query: {mode: 'explorer'},
      staleTime: 0,
    }
  );
}

const makeInitialExplorerAutofixData = (): ExplorerAutofixResponse => ({
  autofix: null,
});

const makeErrorExplorerAutofixData = (errorMessage: string): ExplorerAutofixResponse => ({
  autofix: {
    run_id: 0,
    blocks: [
      {
        id: 'error',
        message: {
          role: 'assistant',
          content: `Error: ${errorMessage}`,
        },
        timestamp: new Date().toISOString(),
        loading: false,
      },
    ],
    status: 'error',
    updated_at: new Date().toISOString(),
  },
});

/**
 * Determines if we're actively processing (fast polling needed).
 */
const isActivelyProcessing = (
  autofixState: ExplorerAutofixState | null,
  runStarted: boolean
): boolean => {
  if (!autofixState) {
    return runStarted;
  }

  // Check if any PR is being created
  const anyPRCreating = Object.values(autofixState.repo_pr_states ?? {}).some(
    state => state.pr_creation_status === 'creating'
  );

  const anyCodingAgentsRunning = Object.values(autofixState.coding_agents ?? {}).some(
    codingAgent =>
      codingAgent.status === CodingAgentStatus.PENDING ||
      codingAgent.status === CodingAgentStatus.RUNNING
  );

  const hasQueuedFeedback = (autofixState.queued_feedback ?? []).length > 0;

  return (
    autofixState.status === 'processing' ||
    autofixState.blocks.some(block => block.loading) ||
    anyPRCreating ||
    anyCodingAgentsRunning ||
    hasQueuedFeedback
  );
};

const hasCreatedPullRequest = (autofixState: ExplorerAutofixState | null): boolean =>
  Object.values(autofixState?.repo_pr_states ?? {}).some(
    state => state.pr_creation_status === 'completed'
  );

/**
 * Gets the appropriate poll interval based on state.
 */
export const getPollInterval = ({
  autofixState,
  runStarted,
  pollPR = false,
}: {
  autofixState: ExplorerAutofixState | null;
  runStarted: boolean;
  pollPR?: boolean;
}): number | false => {
  const shouldPollPR = pollPR && hasCreatedPullRequest(autofixState);
  const shouldPollProcessing = isActivelyProcessing(autofixState, runStarted);

  if (shouldPollPR || shouldPollProcessing) {
    return POLL_INTERVAL;
  }

  return false;
};

export interface AutofixSection {
  artifacts: AutofixArtifact[];
  blocks: Block[];
  status: 'processing' | 'completed';
  step: string;
  index?: number;
}

function sectionStepFor(step: string): string {
  return step === 'pr_iteration' ? 'code_changes' : step;
}

function mergeFilePatches(blocks: Block[]): ExplorerFilePatch[] {
  const mergedByFile = new Map<string, ExplorerFilePatch>();
  for (const block of blocks) {
    for (const patch of block.merged_file_patches ?? []) {
      mergedByFile.set(`${patch.repo_name}:${patch.patch.path}`, patch);
    }
  }
  return Array.from(mergedByFile.values());
}

/**
 * Builds a single section from the blocks that belong to it.
 *
 * The section's artifacts are the inline artifacts carried by its blocks plus,
 * for the code_changes section, the cumulative file-patch diff merged from all
 * of its blocks (code changes and every pr_iteration folded in).
 */
function buildSection(
  step: string,
  index: number,
  blocks: Block[],
  runState: ExplorerAutofixState | null
): AutofixSection {
  const artifacts: AutofixArtifact[] = blocks.flatMap(block => block.artifacts ?? []);

  const section: AutofixSection = {
    index,
    step,
    blocks,
    artifacts,
    status: 'processing',
  };

  if (
    runState?.status !== 'processing' ||
    isLastBlockOfSection(blocks[blocks.length - 1]) ||
    artifacts.length > 0
  ) {
    section.status = 'completed';
  }

  if (isCodeChangesSection(section)) {
    const patches = mergeFilePatches(blocks);
    if (patches.length) {
      artifacts.push(patches);
    }
  }

  return section;
}

/**
 * Groups a flat list of autofix blocks into ordered sections.
 *
 * Blocks arrive as a flat stream from the backend. Each block may carry a
 * `metadata.step` field that signals which logical section it belongs to
 * (e.g. "root_cause", "code_changes"). The first block always carries a step,
 * and a step-less block belongs to whichever section is currently open. We
 * first bucket the blocks by section — folding `pr_iteration` work into the
 * single `code_changes` section — then build each section from its blocks,
 * attaching the relevant artifacts (file patches, PR states). At most one
 * section exists per step.
 */
export function getOrderedAutofixSections(runState: ExplorerAutofixState | null) {
  const blocks = runState?.blocks ?? [];
  if (!blocks.length) {
    return [];
  }

  // Bucket blocks by section step, preserving first-seen order. Each bucket
  // also records the index of its first block, used as the reset/restart point.
  const buckets = new Map<string, {blocks: Block[]; index: number}>();

  // The section a step-less block belongs to. The first block always carries a
  // step, so this is set before any block is bucketed.
  let currentStep = '';

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]!;
    const step = block.message.metadata?.step;
    if (defined(step)) {
      currentStep = sectionStepFor(step);
    }

    const bucket = buckets.get(currentStep);
    if (bucket) {
      bucket.blocks.push(block);
    } else {
      buckets.set(currentStep, {blocks: [block], index: i});
    }
  }

  const sections: AutofixSection[] = Array.from(buckets.entries()).map(
    ([step, {blocks: sectionBlocks, index}]) =>
      buildSection(step, index, sectionBlocks, runState)
  );

  // If there are any PR states, append a synthetic "pull_request" section.
  const pullRequests = Object.values(runState?.repo_pr_states ?? {});
  if (pullRequests.length) {
    sections.push({
      step: 'pull_request',
      artifacts: [pullRequests],
      blocks: [],
      status: pullRequests.some(
        pullRequest => pullRequest.pr_creation_status === 'creating'
      )
        ? 'processing'
        : 'completed',
    });
  }

  const codingAgents = Object.values(runState?.coding_agents ?? {});
  if (codingAgents.length) {
    sections.push({
      step: 'coding_agents',
      artifacts: [codingAgents],
      blocks: [],
      status: codingAgents.some(
        codingAgent =>
          codingAgent.status === CodingAgentStatus.PENDING ||
          codingAgent.status === CodingAgentStatus.RUNNING
      )
        ? 'processing'
        : 'completed',
    });
  }

  return sections;
}

export function isRootCauseSection(section: AutofixSection): boolean {
  return section.step === 'root_cause';
}

export function isSolutionSection(section: AutofixSection): boolean {
  return section.step === 'solution';
}

export function isCodeChangesSection(section: AutofixSection): boolean {
  return section.step === 'code_changes';
}

export function isPrIterationBlock(block: Block): boolean {
  return block.message.metadata?.step === 'pr_iteration';
}

export function isPullRequestsSection(section: AutofixSection): boolean {
  return section.step === 'pull_request';
}

export function isCodingAgentsSection(section: AutofixSection): boolean {
  return section.step === 'coding_agents';
}

export function isRunValidForPrIteration(organization: Organization): boolean {
  return organization.features.includes('autofix-pr-iteration');
}

export function isLastStepPrIteration(runState: ExplorerAutofixState | null): boolean {
  // pr_iteration is always the last work to run, so if the most recent block
  // with a step came from one, the run is in the pr_iteration phase (whether it
  // completed or errored).
  const lastBlock = runState?.blocks.findLast(block =>
    defined(block.message.metadata?.step)
  );
  return defined(lastBlock) && isPrIterationBlock(lastBlock);
}

export type AutofixArtifact =
  | Artifact<unknown>
  | ExplorerFilePatch[]
  | RepoPRState[]
  | ExplorerCodingAgentState[];

export function getAutofixArtifactFromSection(
  section: AutofixSection
): AutofixArtifact | null {
  if (section.status === 'completed') {
    // these artifacts are only usable once the section has completed running
    if (isRootCauseSection(section)) {
      return section.artifacts.findLast(isRootCauseArtifact) ?? null;
    }
    if (isSolutionSection(section)) {
      return section.artifacts.findLast(isSolutionArtifact) ?? null;
    }
    if (isCodeChangesSection(section)) {
      return section.artifacts.findLast(isCodeChangesArtifact) ?? null;
    }
  }
  if (isPullRequestsSection(section)) {
    return section.artifacts.findLast(isPullRequestsArtifact) ?? null;
  }
  if (isCodingAgentsSection(section)) {
    return section.artifacts.findLast(isCodingAgentsArtifact) ?? null;
  }
  return null;
}

function isLastBlockOfSection(block?: Block): boolean {
  return (
    block?.message?.role === 'assistant' &&
    block?.message?.content !== 'Thinking...' &&
    !block?.message?.tool_calls?.length
  );
}

interface UseExplorerAutofixOptions {
  /**
   * Whether to enable the hook and make API calls.
   * When false, the hook returns null state and no-op functions.
   * Defaults to true.
   */
  enabled?: boolean;
  /**
   * Force fast polling while the drawer is mounted. Other observers can keep
   * their processing-aware intervals.
   */
  pollPR?: boolean;
}

/**
 * Hook for managing Explorer-based autofix state and actions.
 *
 * This hook provides:
 * - Polling for autofix state when processing
 * - Starting autofix steps (root_cause, solution, code_changes, etc.)
 * - Creating pull requests from code changes
 */
export function useExplorerAutofix(
  group: Group,
  options: UseExplorerAutofixOptions = {}
) {
  const groupId = group.id;
  const {openModal} = useModal();

  const {enabled = true, pollPR = false} = options;
  const api = useApi();
  const queryClient = useQueryClient();
  const organization = useOrganization();
  const user = useUser();
  const orgSlug = organization.slug;
  const serviceWorker = useServiceWorker();

  const [waitingForResponse, setWaitingForResponse] = useState(false);

  /**
   * Triggering coding agents take a while and explorer state doesn't update until the end.
   * This means while the request on ongoing, we need to disable the UI to prevent users
   * from clicking other steps.
   */
  const [waitingForCodingAgent, setWaitingForCodingAgent] = useState(false);

  const [codingAgentErrors, setCodingAgentErrors] = useState<CodingAgentError[]>([]);
  const nextCodingAgentErrorId = useRef(0);
  const appendCodingAgentErrors = useCallback((messages: string[]) => {
    setCodingAgentErrors(prev => [
      ...prev,
      ...messages.map(message => ({id: nextCodingAgentErrorId.current++, message})),
    ]);
  }, []);

  const {data: apiData, isPending} = useQuery({
    ...explorerAutofixApiOptions(orgSlug, groupId),
    retry: false,
    enabled,
    refetchInterval: query => {
      if (!enabled) {
        return false;
      }

      const autofixState = query.state.data?.json?.autofix || null;
      return getPollInterval({autofixState, runStarted: waitingForResponse, pollPR});
    },
  });

  const runState = apiData?.autofix ?? null;

  const startStep = useCallback(
    async (
      step: AutofixExplorerStep,
      startStepOptions?: {
        /**
         * The index of the block to start the step. If specified, existing blocks from this index onwards is reset.
         */
        insertIndex?: number;
        /**
         * The run id where we want to start the step. If not specified, a new run is created
         */
        runId?: number;
        /**
         * Additional context from the user. If specified, it is added to the builtin prompt
         */
        userContext?: string;
      }
    ) => {
      setWaitingForResponse(true);

      try {
        const data: Record<string, any> = {step, referrer: 'api.web'};

        if (defined(startStepOptions?.insertIndex)) {
          data.insert_index = startStepOptions.insertIndex;
        }

        if (defined(startStepOptions?.runId)) {
          data.run_id = startStepOptions.runId;
        }

        if (startStepOptions?.userContext) {
          data.user_context = startStepOptions.userContext;
        }

        const response = await api.requestPromise(
          getApiUrl('/organizations/$organizationIdOrSlug/issues/$issueId/autofix/', {
            path: {organizationIdOrSlug: orgSlug, issueId: groupId},
          }),
          {
            method: 'POST',
            query: {mode: 'explorer'},
            data,
          }
        );

        // Invalidate to fetch fresh data
        const invalidation = queryClient.invalidateQueries({
          queryKey: explorerAutofixApiOptions(orgSlug, groupId).queryKey,
        });

        if (step === 'pr_iteration') {
          await invalidation;
        }

        if (
          organization.features.includes('autofix-browser-notifications') &&
          serviceWorker.isServiceWorkerSupported
        ) {
          serviceWorker.controller
            .postMessage({
              type: 'event',
              name: 'autofix.startStep',
              data: {
                issueId: groupId,
                notification: {
                  navigateTo: {
                    pathname: normalizeUrl(
                      `/organizations/${orgSlug}/issues/${groupId}/`
                    ),
                    query: {
                      seerDrawer: 'true',
                    },
                  },
                  project: {
                    avatar: 'https://sentry.io/favicon.ico', // TODO(ryan953): Use the project avatar url or base64 encoded bytes
                  },
                  title: {
                    success: `${group.shortId} - ${step.replace('_', ' ')} completed`,
                    error: `${group.shortId} - ${step.replace('_', ' ')} had a problem`,
                  },
                  body: {
                    success: `Click to see the ${step.replace('_', ' ')} results.`,
                    error: 'The autofix run ended with an error.',
                  },
                },
                organizationIdOrSlug: orgSlug,
                step,
                stepOptions: startStepOptions ?? {},
              },
            })
            .catch(error => {
              addErrorMessage(error instanceof Error ? error.message : String(error));
            });
        }

        return response.run_id as number;
      } catch (e: any) {
        setWaitingForResponse(false);
        queryClient.setQueryData(
          explorerAutofixApiOptions(orgSlug, groupId).queryKey,
          prev => ({
            headers: prev?.headers ?? {},
            json: makeErrorExplorerAutofixData(
              e?.responseJSON?.detail ?? 'An error occurred'
            ),
          })
        );
        throw e;
      }
    },
    [
      api,
      group.shortId,
      groupId,
      orgSlug,
      organization.features,
      queryClient,
      serviceWorker,
    ]
  );

  /**
   * Create a pull request from the code changes.
   *
   * @param runId - The run ID to create PR for
   * @param repoName - Optional specific repo to create PR for
   */
  const createPR = useCallback(
    async (runId: number, repoName?: string) => {
      try {
        const data: Record<string, any> = {
          step: 'open_pr',
          run_id: runId,
          referrer: 'api.web',
        };
        if (repoName) {
          data.repo_name = repoName;
        }
        await api.requestPromise(
          getApiUrl('/organizations/$organizationIdOrSlug/issues/$issueId/autofix/', {
            path: {organizationIdOrSlug: orgSlug, issueId: groupId},
          }),
          {
            method: 'POST',
            query: {mode: 'explorer'},
            data,
          }
        );

        // Invalidate to trigger polling for status updates
        queryClient.invalidateQueries({
          queryKey: explorerAutofixApiOptions(orgSlug, groupId).queryKey,
        });
      } catch (e: any) {
        addErrorMessage(e?.responseJSON?.detail ?? 'Failed to create PR');
        throw e;
      }
    },
    [api, orgSlug, groupId, queryClient]
  );

  /**
   * Reset the autofix state to start fresh.
   */
  const reset = useCallback(() => {
    setWaitingForResponse(false);
    setWaitingForCodingAgent(false);
    queryClient.setQueryData(
      explorerAutofixApiOptions(orgSlug, groupId).queryKey,
      prev => ({headers: prev?.headers ?? {}, json: makeInitialExplorerAutofixData()})
    );
  }, [queryClient, orgSlug, groupId]);

  /**
   * Trigger coding agent handoff for an existing run.
   */
  const triggerCodingAgentHandoff = useCallback(
    async (runId: number, integration: CodingAgentIntegration) => {
      setWaitingForCodingAgent(true);

      trackAnalytics('coding_integration.send_to_agent_clicked', {
        organization,
        group_id: groupId,
        provider: integration.provider,
        source: 'explorer',
        user_id: user.id,
      });

      addLoadingMessage('Launching coding agent...');

      const data: Record<string, string | number> = {
        step: 'coding_agent_handoff',
        run_id: runId,
        referrer: 'api.web',
      };

      if (integration.id === null) {
        data.provider = integration.provider;
      } else {
        data.integration_id = parseInt(integration.id, 10);
      }

      try {
        const response: {
          failures: Array<{
            error_message: string;
            repo_name: string;
            failure_type?: string;
            github_installation_id?: string;
          }>;
          successes: unknown[];
        } = await api.requestPromise(
          getApiUrl('/organizations/$organizationIdOrSlug/issues/$issueId/autofix/', {
            path: {organizationIdOrSlug: orgSlug, issueId: groupId},
          }),
          {
            method: 'POST',
            query: {mode: 'explorer'},
            data,
          }
        );

        // Check for failures in the response
        if (response.failures && response.failures.length > 0) {
          const permissionFailures = response.failures.filter(
            f => f.failure_type === 'github_app_permissions'
          );
          const copilotLicenseFailures = response.failures.filter(
            f => f.failure_type === 'github_copilot_not_licensed'
          );
          const cursorGithubAccessFailures = response.failures.filter(
            f => f.failure_type === 'cursor_github_access'
          );
          const otherFailures = response.failures.filter(
            f =>
              f.failure_type !== 'github_app_permissions' &&
              f.failure_type !== 'github_copilot_not_licensed' &&
              f.failure_type !== 'cursor_github_access'
          );

          if (permissionFailures.length > 0) {
            const installationId = permissionFailures[0]?.github_installation_id;
            const installationUrl = installationId
              ? getGithubPermissionsUpdateUrl(installationId)
              : undefined;
            openModal(deps => (
              <AutofixGithubAppPermissionsModal
                {...deps}
                installationUrl={installationUrl}
              />
            ));
          }

          if (copilotLicenseFailures.length > 0) {
            openModal(deps => <AutofixGithubCopilotPurchaseModal {...deps} />);
          }

          if (cursorGithubAccessFailures.length > 0) {
            openModal(deps => <AutofixCursorGithubAccessModal {...deps} />);
          }

          if (otherFailures.length > 0) {
            appendCodingAgentErrors(
              otherFailures.map(f => f.error_message ?? 'Failed to launch coding agent')
            );
          }
        }

        // Invalidate to fetch fresh data
        queryClient.invalidateQueries({
          queryKey: explorerAutofixApiOptions(orgSlug, groupId).queryKey,
        });
      } catch (e: any) {
        if (needsGitHubAuth(e)) {
          const currentUrl = window.location.href;
          window.location.href = `/remote/github-copilot/oauth/?next=${encodeURIComponent(currentUrl)}`;
          return;
        }
        appendCodingAgentErrors([
          e?.responseJSON?.detail ?? 'Failed to launch coding agent',
        ]);
        throw e;
      } finally {
        clearIndicators();
        setWaitingForCodingAgent(false);
      }
    },
    [
      api,
      orgSlug,
      groupId,
      queryClient,
      organization,
      user.id,
      appendCodingAgentErrors,
      openModal,
    ]
  );

  if (waitingForResponse && runState) {
    const hasLoadingBlock = runState.blocks.some(block => block.loading);
    if (!hasLoadingBlock && runState.status !== 'processing') {
      setWaitingForResponse(false);
    }
  }

  return {
    /**
     * Current autofix run state, or null if no run exists.
     */
    runState,
    /**
     * Whether the initial data fetch is pending.
     */
    isLoading: isPending,
    /**
     * Whether we're actively processing (used for UI indicators).
     */
    isPolling:
      isActivelyProcessing(runState, waitingForResponse) || waitingForCodingAgent,
    /**
     * Start or continue an autofix step.
     */
    startStep,
    /**
     * Create a pull request from code changes.
     */
    createPR,
    /**
     * Reset the autofix state.
     */
    reset,
    /**
     * Trigger coding agent handoff for an existing run.
     */
    triggerCodingAgentHandoff,
    /**
     * Errors from coding agent launch attempts, accumulated across launches and
     * persisted for the lifetime of the hook mount. Displayed inline in the panel.
     */
    codingAgentErrors,
    /**
     * Dismiss a single coding agent error by its id.
     */
    dismissCodingAgentError: (id: number) =>
      setCodingAgentErrors(prev => prev.filter(e => e.id !== id)),
    warnings: runState?.warnings ?? [],
  };
}

export function collectPatches(
  patches: ExplorerFilePatch[]
): Map<string, ExplorerFilePatch[]> {
  const patchesByRepo = new Map<string, ExplorerFilePatch[]>();

  for (const patch of patches) {
    const existing = patchesByRepo.get(patch.repo_name) || [];
    existing.push(patch);
    patchesByRepo.set(patch.repo_name, existing);
  }

  for (const [repoName, repoPatches] of patchesByRepo) {
    const cleanedPatches = cleanPatches(repoPatches);
    if (cleanedPatches.length) {
      patchesByRepo.set(repoName, cleanedPatches);
    } else {
      patchesByRepo.delete(repoName);
    }
  }

  return patchesByRepo;
}

function cleanPatches(patches: ExplorerFilePatch[]): ExplorerFilePatch[] {
  const cleanedPatches: ExplorerFilePatch[] = [];

  const patchedFiles = new Set<string>();

  patches.toReversed().forEach(patch => {
    if (patchedFiles.has(patch.patch.path)) {
      return;
    }
    patchedFiles.add(patch.patch.path);
    cleanedPatches.push(patch);
  });

  return cleanedPatches.reverse().filter(patch => {
    return patch.patch.added > 0 || patch.patch.removed > 0;
  });
}
