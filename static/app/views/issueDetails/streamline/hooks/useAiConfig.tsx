import {useAutofixSetup} from 'sentry/components/events/autofix/useAutofixSetup';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';
import {getRegionDataFromOrganization} from 'sentry/utils/regions';
import useOrganization from 'sentry/utils/useOrganization';
import {useIsSampleEvent} from 'sentry/views/issueDetails/utils';

interface AiConfigResult {
  areAiFeaturesAllowed: boolean;
  hasAutofix: boolean;
  hasGithubIntegration: boolean;
  hasResources: boolean;
  hasSummary: boolean;
  isAutofixSetupLoading: boolean;
  /**
   * Nobody in the org has acknowledged seer for the first time.
   */
  needsGenAiAcknowledgement: boolean;
}

export const useAiConfig = (group: Group, project: Project): AiConfigResult => {
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

  const hasGenAIAcknowledgement =
    autofixSetupData?.setupAcknowledgement.orgHasAcknowledged;

  const hasSummary = Boolean(
    hasGenAIAcknowledgement && isSummaryEnabled && areAiFeaturesAllowed
  );
  const hasAutofix = isAutofixEnabled && areAiFeaturesAllowed && !isSampleError;
  const hasGithubIntegration = !!autofixSetupData?.integration.ok;

  const needsGenAiAcknowledgement =
    !autofixSetupData?.setupAcknowledgement.userHasAcknowledged &&
    (isSummaryEnabled || isAutofixEnabled) &&
    areAiFeaturesAllowed;

  return {
    hasSummary,
    hasAutofix,
    needsGenAiAcknowledgement,
    hasResources,
    isAutofixSetupLoading,
    areAiFeaturesAllowed,
    hasGithubIntegration,
  };
};
