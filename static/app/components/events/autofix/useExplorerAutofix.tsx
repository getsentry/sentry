import {useCallback, useState} from 'react';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {
  setApiQueryData,
  useApiQuery,
  useQueryClient,
  type ApiQueryKey,
  type UseApiQueryOptions,
} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import type {
  Artifact,
  Block,
  ExplorerCodingAgentState,
  ExplorerFilePatch,
  RepoPRState,
} from 'sentry/views/seerExplorer/types';

/**
 * Available autofix steps that can be triggered via the Explorer.
 */
export type AutofixExplorerStep =
  | 'root_cause'
  | 'solution'
  | 'code_changes'
  | 'impact_assessment'
  | 'triage';

/**
 * Artifact data types matching the backend Pydantic schemas.
 */
export interface RootCauseArtifact {
  five_whys: string[];
  one_line_description: string;
  reproduction_steps?: string[];
}

interface SolutionStep {
  description: string;
  title: string;
}

export interface SolutionArtifact {
  one_line_summary: string;
  steps: SolutionStep[];
}

export interface ImpactItem {
  evidence: string;
  impact_description: string;
  label: string;
  rating: 'low' | 'medium' | 'high';
}

export interface ImpactAssessmentArtifact {
  impacts: ImpactItem[];
  one_line_description: string;
}

export interface SuspectCommit {
  author_email: string;
  author_name: string;
  committed_date: string;
  description: string;
  message: string;
  repo_name: string;
  sha: string;
}

interface SuggestedAssignee {
  email: string;
  name: string;
  why: string;
}

export interface TriageArtifact {
  suggested_assignee?: SuggestedAssignee | null;
  suspect_commit?: SuspectCommit | null;
}

/**
 * State returned from the Explorer autofix endpoint.
 * This extends the SeerExplorer types with autofix-specific data.
 */
interface ExplorerAutofixState {
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
  repo_pr_states?: Record<string, RepoPRState>;
}

/**
 * Response from the autofix endpoint.
 */
interface ExplorerAutofixResponse {
  autofix: ExplorerAutofixState | null;
}

const POLL_INTERVAL = 500;
const IDLE_POLL_INTERVAL = 2500; // Slower polling when not actively processing

const makeExplorerAutofixQueryKey = (orgSlug: string, groupId: string): ApiQueryKey => [
  `/organizations/${orgSlug}/issues/${groupId}/autofix/`,
];

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

  return (
    autofixState.status === 'processing' ||
    autofixState.blocks.some(block => block.loading) ||
    anyPRCreating
  );
};

/**
 * Gets the appropriate poll interval based on state.
 * Returns false to disable polling, or a number for the interval.
 */
const getPollInterval = (
  autofixState: ExplorerAutofixState | null,
  runStarted: boolean
): number | false => {
  // No run and nothing started - don't poll
  if (!autofixState && !runStarted) {
    return false;
  }

  // Actively processing - poll fast
  if (isActivelyProcessing(autofixState, runStarted)) {
    return POLL_INTERVAL;
  }

  // Has a run but not actively processing - poll slow to catch external updates
  if (autofixState) {
    return IDLE_POLL_INTERVAL;
  }

  return false;
};

/**
 * Extract artifacts from Explorer blocks.
 * Returns the latest artifact for each key (later blocks override earlier ones).
 */
export function getArtifactsFromBlocks(blocks: Block[]): Record<string, Artifact> {
  const artifacts: Record<string, Artifact> = {};

  for (const block of blocks) {
    if (block.artifacts) {
      for (const artifact of block.artifacts) {
        artifacts[artifact.key] = artifact;
      }
    }
  }

  return artifacts;
}

/**
 * Get the ordered list of artifact keys based on their first appearance in blocks.
 * Returns keys sorted by the index of the first block where each artifact appeared.
 */
export function getOrderedArtifactKeys(
  blocks: Block[],
  artifacts: Record<string, Artifact>
): string[] {
  // Map artifact key to the index of the first block where it appeared
  const firstAppearanceIndex: Record<string, number> = {};

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    if (block?.artifacts) {
      for (const artifact of block.artifacts) {
        // Only record the first appearance
        if (!(artifact.key in firstAppearanceIndex)) {
          firstAppearanceIndex[artifact.key] = i;
        }
      }
    }
  }

  // Get all artifact keys that exist in artifacts
  const artifactKeys = Object.keys(artifacts).filter(key => key in firstAppearanceIndex);

  // Sort by first appearance index
  return artifactKeys.sort((a, b) => {
    const indexA = firstAppearanceIndex[a] ?? Infinity;
    const indexB = firstAppearanceIndex[b] ?? Infinity;
    return indexA - indexB;
  });
}

/**
 * Extract merged file patches from Explorer blocks.
 * Returns the latest merged patch (original → current) for each file.
 */
export function getMergedFilePatchesFromBlocks(blocks: Block[]): ExplorerFilePatch[] {
  const mergedByFile = new Map<string, ExplorerFilePatch>();

  for (const block of blocks) {
    if (block.merged_file_patches) {
      for (const patch of block.merged_file_patches) {
        const key = `${patch.repo_name}:${patch.patch.path}`;
        mergedByFile.set(key, patch);
      }
    }
  }

  return Array.from(mergedByFile.values());
}

/**
 * Check if there are code changes in the state.
 */
export function hasCodeChanges(blocks: Block[]): boolean {
  return blocks.some(
    block => block.merged_file_patches && block.merged_file_patches.length > 0
  );
}

interface UseExplorerAutofixOptions {
  /**
   * Whether to enable the hook and make API calls.
   * When false, the hook returns null state and no-op functions.
   * Defaults to true.
   */
  enabled?: boolean;
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
  groupId: string,
  options: UseExplorerAutofixOptions = {}
) {
  const {enabled = true} = options;
  const api = useApi();
  const queryClient = useQueryClient();
  const organization = useOrganization();
  const orgSlug = organization.slug;

  const [waitingForResponse, setWaitingForResponse] = useState(false);

  const {data: apiData, isPending} = useApiQuery<ExplorerAutofixResponse>(
    makeExplorerAutofixQueryKey(orgSlug, groupId),
    {
      staleTime: 0,
      retry: false,
      enabled,
      refetchInterval: query => {
        if (!enabled) {
          return false;
        }
        return getPollInterval(
          query.state.data?.[0]?.autofix || null,
          waitingForResponse
        );
      },
    } as UseApiQueryOptions<ExplorerAutofixResponse, RequestError>
  );

  const runState = apiData?.autofix ?? null;

  /**
   * Start or continue an autofix step.
   *
   * @param step - The step to run (root_cause, solution, code_changes, etc.)
   * @param runId - Optional run ID to continue an existing run
   */
  const startStep = useCallback(
    async (step: AutofixExplorerStep, runId?: number) => {
      setWaitingForResponse(true);

      try {
        const response = await api.requestPromise(
          `/organizations/${orgSlug}/issues/${groupId}/autofix/`,
          {
            method: 'POST',
            data: {
              step,
              ...(runId !== undefined && {run_id: runId}),
            },
          }
        );

        // Invalidate to fetch fresh data
        queryClient.invalidateQueries({
          queryKey: makeExplorerAutofixQueryKey(orgSlug, groupId),
        });

        return response.run_id as number;
      } catch (e: any) {
        setWaitingForResponse(false);
        setApiQueryData<ExplorerAutofixResponse>(
          queryClient,
          makeExplorerAutofixQueryKey(orgSlug, groupId),
          makeErrorExplorerAutofixData(e?.responseJSON?.detail ?? 'An error occurred')
        );
        throw e;
      }
    },
    [api, orgSlug, groupId, queryClient]
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
        await api.requestPromise(
          `/organizations/${orgSlug}/seer/explorer-update/${runId}/`,
          {
            method: 'POST',
            data: {
              payload: {
                type: 'create_pr',
                repo_name: repoName,
              },
            },
          }
        );

        // Invalidate to trigger polling for status updates
        queryClient.invalidateQueries({
          queryKey: makeExplorerAutofixQueryKey(orgSlug, groupId),
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
    setApiQueryData<ExplorerAutofixResponse>(
      queryClient,
      makeExplorerAutofixQueryKey(orgSlug, groupId),
      makeInitialExplorerAutofixData()
    );
  }, [queryClient, orgSlug, groupId]);

  /**
   * Trigger coding agent handoff for an existing run.
   */
  const triggerCodingAgentHandoff = useCallback(
    async (runId: number, integrationId: number) => {
      setWaitingForResponse(true);

      try {
        await api.requestPromise(`/organizations/${orgSlug}/issues/${groupId}/autofix/`, {
          method: 'POST',
          data: {
            step: 'coding_agent_handoff',
            run_id: runId,
            integration_id: integrationId,
          },
        });

        // Invalidate to fetch fresh data
        queryClient.invalidateQueries({
          queryKey: makeExplorerAutofixQueryKey(orgSlug, groupId),
        });
      } catch (e: any) {
        setWaitingForResponse(false);
        addErrorMessage(e?.responseJSON?.detail ?? 'Failed to launch coding agent');
        throw e;
      }
    },
    [api, orgSlug, groupId, queryClient]
  );

  // Clear waiting state when we get a response
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
    isPolling: isActivelyProcessing(runState, waitingForResponse),
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
  };
}
