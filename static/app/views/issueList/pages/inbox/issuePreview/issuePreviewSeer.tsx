import {createContext, useContext, type ReactNode} from 'react';

import {useAutofixCreditCheck} from 'sentry/components/events/autofix/autofixCredits';
import {getAutofixNextStep} from 'sentry/components/events/autofix/getAutofixNextStep';
import {findCodingAgentResultLink} from 'sentry/components/events/autofix/pullRequests';
import {
  collectPatches,
  getAutofixArtifactFromSection,
  getOrderedAutofixSections,
  isCodeChangesArtifact,
  useExplorerAutofix,
  type AutofixSection,
} from 'sentry/components/events/autofix/useExplorerAutofix';
import {useAutofixSetupStep} from 'sentry/components/events/autofix/v3/autofixSetupCard';
import {ProgressState, type Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';
import {useAiConfig} from 'sentry/views/issueDetails/hooks/useAiConfig';

import {
  hidesCodingAgentResultLink,
  useIssuePreviewPullRequests,
} from './issuePreviewPullRequests';

type IssuePreviewSeerState =
  | 'unavailable'
  | 'loading'
  | 'configure'
  | 'start'
  | 'summary';

/**
 * Once a fix has landed, the header offers to resolve the issue instead of a
 * Seer action.
 */
export function isAwaitingResolution(group: Group, project: Project): boolean {
  return (
    group.derivedData?.progress === ProgressState.FIX_APPLIED &&
    getConfigForIssueType(group, project).actions.resolve.enabled
  );
}

export function hasCodeChanges(section: AutofixSection): boolean {
  const artifact = getAutofixArtifactFromSection(section);
  return collectPatches(isCodeChangesArtifact(artifact) ? artifact : []).size > 0;
}

/**
 * The autofix action behind the header's Seer button, following the same
 * branches as `SeerActionButton`. Null when that button only links somewhere,
 * waits on a run, or retries a failed PR, none of which start a new step.
 */
function getSeerButtonAction(
  state: IssuePreviewSeerState,
  autofix: ReturnType<typeof useExplorerAutofix>,
  {suppressResultLink}: {suppressResultLink: boolean}
) {
  if (state === 'start') {
    return 'root_cause';
  }

  const {runState} = autofix;
  if (
    state !== 'summary' ||
    !runState ||
    runState.status === 'awaiting_user_input' ||
    autofix.isProcessing
  ) {
    return null;
  }

  const repoPrStates = Object.values(runState.repo_pr_states ?? {});
  if (repoPrStates.some(pullRequest => pullRequest.pr_creation_status === 'error')) {
    return null;
  }

  const codingAgents = Object.values(runState.coding_agents ?? {});
  if (
    (findCodingAgentResultLink(codingAgents) && !suppressResultLink) ||
    codingAgents.some(a => a.agent_url)
  ) {
    return null;
  }

  const nextStep = getAutofixNextStep({
    sections: getOrderedAutofixSections(runState),
    runState,
  });
  switch (nextStep?.action) {
    case 'create_pr':
      return hasCodeChanges(nextStep.section) ? 'create_pr' : null;
    case 'code_changes':
    case 'solution':
      return nextStep.action;
    default:
      // "Restart Autofix"
      return 'root_cause';
  }
}

function useIssuePreviewSeerState(group: Group, project: Project) {
  const aiConfig = useAiConfig(group, project);
  const autofix = useExplorerAutofix(group, {
    enabled: aiConfig.hasAutofix,
  });
  const {isPending: isSetupPending, setupType} = useAutofixSetupStep({
    seerReposLinked: aiConfig.seerReposLinked,
  });
  const {pullRequests} = useIssuePreviewPullRequests(group);
  let state: IssuePreviewSeerState;
  if (!aiConfig.hasAutofix) {
    state = 'unavailable';
  } else if (
    aiConfig.isAutofixSetupLoading ||
    (aiConfig.hasAutofixQuota && isSetupPending)
  ) {
    state = 'loading';
  } else if (!aiConfig.hasAutofixQuota || setupType) {
    state = 'configure';
  } else if (autofix.isLoading && !autofix.isWaitingForRun) {
    state = 'loading';
  } else if (!autofix.runState && !autofix.isWaitingForRun) {
    state = 'start';
  } else {
    state = 'summary';
  }

  const creditAction = isAwaitingResolution(group, project)
    ? null
    : getSeerButtonAction(state, autofix, {
        suppressResultLink: hidesCodingAgentResultLink(pullRequests),
      });
  const creditCheck = useAutofixCreditCheck(creditAction);

  return {
    aiConfig,
    autofix,
    /**
     * The autofix action the header's Seer button would start, or null when
     * it starts nothing billable.
     */
    creditAction,
    /**
     * Whether the org can afford `creditAction`.
     */
    creditCheck,
    state,
  };
}

type PreviewSeer = ReturnType<typeof useIssuePreviewSeerState>;

const IssuePreviewSeerContext = createContext<PreviewSeer | null>(null);

export function IssuePreviewSeerProvider({
  children,
  group,
  project,
}: {
  children: ReactNode;
  group: Group;
  project: Project;
}) {
  const previewSeer = useIssuePreviewSeerState(group, project);

  return (
    <IssuePreviewSeerContext.Provider value={previewSeer}>
      {children}
    </IssuePreviewSeerContext.Provider>
  );
}

export function useIssuePreviewSeer() {
  const previewSeer = useContext(IssuePreviewSeerContext);
  if (!previewSeer) {
    throw new Error('useIssuePreviewSeer must be used within IssuePreviewSeerProvider');
  }
  return previewSeer;
}
