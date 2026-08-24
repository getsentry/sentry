import {useExplorerAutofix} from 'sentry/components/events/autofix/useExplorerAutofix';
import {AutofixStartCardContent} from 'sentry/components/events/autofix/v3/autofixStartCard';
import {ProgressState, type Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {useAiConfig} from 'sentry/views/issueDetails/hooks/useAiConfig';
import {IssuePreviewAutofixSummary} from 'sentry/views/issueDetails/issuePreview/issuePreviewAutofixSummary';
import {AutofixQuotaContent} from 'sentry/views/issueDetails/sidebar/autofixSection';

type IssuePreviewSeerState = 'configure' | 'start' | 'summary';

export function useIssuePreviewSeer(group: Group, project: Project) {
  const aiConfig = useAiConfig(group, project);
  const autofix = useExplorerAutofix(group, {
    enabled: aiConfig.hasAutofix,
  });
  let state: IssuePreviewSeerState = 'summary';
  if (
    group.derivedData?.progress === ProgressState.ASSIGNED &&
    !aiConfig.isAutofixSetupLoading
  ) {
    if (
      !aiConfig.hasAutofixQuota ||
      (aiConfig.hasGithubIntegration && !aiConfig.seerReposLinked)
    ) {
      state = 'configure';
    } else if (!autofix.runState && !autofix.isWaitingForRun) {
      state = 'start';
    }
  }

  return {
    aiConfig,
    autofix,
    hasAutofix: aiConfig.hasAutofix,
    isLoading:
      aiConfig.hasAutofix &&
      (aiConfig.isAutofixSetupLoading ||
        (state !== 'configure' && autofix.isLoading && !autofix.isWaitingForRun)),
    shouldShowSeerActions:
      aiConfig.hasAutofix && (state === 'start' || state === 'summary'),
    state,
  };
}

type PreviewSeer = ReturnType<typeof useIssuePreviewSeer>;

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

  if (state === 'configure') {
    return <AutofixQuotaContent aiConfig={aiConfig} group={group} project={project} />;
  }

  if (state === 'start') {
    return <AutofixStartCardContent />;
  }

  return <IssuePreviewAutofixSummary autofix={autofix} groupId={group.id} />;
}
