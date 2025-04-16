import {useAutofixSetup} from 'sentry/components/events/autofix/useAutofixSetup';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';
import {getRegionDataFromOrganization} from 'sentry/utils/regions';
import useOrganization from 'sentry/utils/useOrganization';
import {useIsSampleEvent} from 'sentry/views/issueDetails/utils';

export const useAiConfig = (group: Group, project: Project) => {
  const organization = useOrganization();
  const {data: autofixSetupData, isPending: isAutofixSetupLoading} = useAutofixSetup({
    groupId: group.id,
  });

  const isSampleError = useIsSampleEvent();

  const issueTypeConfig = getConfigForIssueType(group, project);

  const areAiFeaturesAllowed =
    !organization.hideAiFeatures &&
    getRegionDataFromOrganization(organization)?.name !== 'de' &&
    organization.features.includes('gen-ai-features');

  const isSummaryEnabled = issueTypeConfig.issueSummary.enabled;
  const isAutofixEnabled = issueTypeConfig.autofix;
  const hasResources = !!issueTypeConfig.resources;

  const hasGenAIConsent = autofixSetupData?.genAIConsent.ok ?? organization.genAIConsent;

  const hasSummary = hasGenAIConsent && isSummaryEnabled && areAiFeaturesAllowed;
  const hasAutofix = isAutofixEnabled && areAiFeaturesAllowed && !isSampleError;
  const hasGithubIntegration = autofixSetupData?.integration.ok;

  const needsGenAIConsent =
    !hasGenAIConsent && (isSummaryEnabled || isAutofixEnabled) && areAiFeaturesAllowed;

  return {
    hasSummary,
    hasAutofix,
    needsGenAIConsent,
    hasResources,
    isAutofixSetupLoading,
    areAiFeaturesAllowed,
    hasGithubIntegration,
  };
};
