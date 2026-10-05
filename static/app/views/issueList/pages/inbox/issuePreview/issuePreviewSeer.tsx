import {createContext, useContext, type ReactNode} from 'react';

import {useExplorerAutofix} from 'sentry/components/events/autofix/useExplorerAutofix';
import {AutofixStartCardContent} from 'sentry/components/events/autofix/v3/autofixStartCard';
import {ProgressState, type Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {useAiConfig} from 'sentry/views/issueDetails/hooks/useAiConfig';
import {AutofixQuotaContent} from 'sentry/views/issueDetails/sidebar/autofixSection';
import {IssuePreviewAutofixSummary} from 'sentry/views/issueList/pages/inbox/issuePreview/issuePreviewAutofixSummary';

type IssuePreviewSeerState =
  | 'unavailable'
  | 'loading'
  | 'configure'
  | 'start'
  | 'summary';

function useIssuePreviewSeerState(group: Group, project: Project) {
  const aiConfig = useAiConfig(group, project);
  const autofix = useExplorerAutofix(group, {
    enabled: aiConfig.hasAutofix,
  });
  const isAssigned = group.derivedData?.progress === ProgressState.ASSIGNED;
  let state: IssuePreviewSeerState;
  if (!aiConfig.hasAutofix) {
    state = 'unavailable';
  } else if (aiConfig.isAutofixSetupLoading) {
    state = 'loading';
  } else if (
    isAssigned &&
    (!aiConfig.hasAutofixQuota ||
      (aiConfig.hasGithubIntegration && !aiConfig.seerReposLinked))
  ) {
    state = 'configure';
  } else if (autofix.isLoading && !autofix.isWaitingForRun) {
    state = 'loading';
  } else if (isAssigned && !autofix.runState && !autofix.isWaitingForRun) {
    state = 'start';
  } else {
    state = 'summary';
  }

  return {
    aiConfig,
    autofix,
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

export function IssuePreviewSeerContent({
  group,
  previewSeer,
  project,
}: {
  group: Group;
  previewSeer: PreviewSeer;
  project: Project;
}) {
  const {aiConfig, autofix, state} = previewSeer;

  if (state === 'unavailable' || state === 'loading') {
    return null;
  }

  if (state === 'configure') {
    return <AutofixQuotaContent aiConfig={aiConfig} group={group} project={project} />;
  }

  if (state === 'start') {
    return <AutofixStartCardContent />;
  }

  return <IssuePreviewAutofixSummary autofix={autofix} groupId={group.id} />;
}
