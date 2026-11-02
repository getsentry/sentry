import {createContext, useContext, type ReactNode} from 'react';

import {useExplorerAutofix} from 'sentry/components/events/autofix/useExplorerAutofix';
import {useAutofixSetupStep} from 'sentry/components/events/autofix/v3/autofixSetupCard';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {useAiConfig} from 'sentry/views/issueDetails/hooks/useAiConfig';

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
  const {isPending: isSetupPending, setupType} = useAutofixSetupStep({
    seerReposLinked: aiConfig.seerReposLinked,
  });
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
