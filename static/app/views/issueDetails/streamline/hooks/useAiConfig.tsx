import {useAutofixSetup} from 'sentry/components/events/autofix/useAutofixSetup';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';
import useOrganization from 'sentry/utils/useOrganization';
import {useIsSampleEvent} from 'sentry/views/issueDetails/utils';

interface AiConfigResult {
  areAiFeaturesAllowed: boolean;
  hasAutofix: boolean;
  hasAutofixQuota: boolean;
  hasGithubIntegration: boolean;
  hasResources: boolean;
  hasSummary: boolean;
  isAutofixSetupLoading: boolean;
  needsGenAiAcknowledgement: boolean;
  orgNeedsGenAiAcknowledgement: boolean;
  refetchAutofixSetup: () => void;
}

export const useAiConfig = (group: Group, project: Project): AiConfigResult => {
  const organization = useOrganization();
  const {
    data: autofixSetupData,
    isPending: isAutofixSetupLoading,
    hasAutofixQuota,
    refetch: refetchAutofixSetup,
  } = useAutofixSetup({
    groupId: group.id,
  });

  const isSampleError = useIsSampleEvent();

  const issueTypeConfig = getConfigForIssueType(group, project);

  const areAiFeaturesAllowed =
    !organization.hideAiFeatures && organization.features.includes('gen-ai-features');

  const isSummaryEnabled = issueTypeConfig.issueSummary.enabled;
  const isAutofixEnabled = issueTypeConfig.autofix;
  const hasResources = !!issueTypeConfig.resources;

  const hasSummary = Boolean(isSummaryEnabled && areAiFeaturesAllowed);
  const hasAutofix = isAutofixEnabled && areAiFeaturesAllowed && !isSampleError;
  const hasGithubIntegration = !!autofixSetupData?.integration.ok;

  const needsGenAiAcknowledgement =
    !autofixSetupData?.setupAcknowledgement.userHasAcknowledged &&
    (isSummaryEnabled || isAutofixEnabled) &&
    areAiFeaturesAllowed;

  const orgNeedsGenAiAcknowledgement =
    !autofixSetupData?.setupAcknowledgement.orgHasAcknowledged &&
    (isSummaryEnabled || isAutofixEnabled) &&
    areAiFeaturesAllowed;

  return {
    hasSummary,
    hasAutofix,
    needsGenAiAcknowledgement,
    orgNeedsGenAiAcknowledgement,
    hasResources,
    isAutofixSetupLoading,
    areAiFeaturesAllowed,
    hasGithubIntegration,
    hasAutofixQuota,
    refetchAutofixSetup,
  };
};
