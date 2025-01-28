import {useAutofixSetup} from 'sentry/components/events/autofix/useAutofixSetup';
import {EntryType, type Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';
import {getRegionDataFromOrganization} from 'sentry/utils/regions';
import useOrganization from 'sentry/utils/useOrganization';
import {useIsSampleEvent} from 'sentry/views/issueDetails/utils';

// Autofix requires the event to have stack trace frames in order to work correctly.
function hasStacktraceWithFrames(event: Event) {
  for (const entry of event.entries) {
    if (entry.type === EntryType.EXCEPTION) {
      if (entry.data.values?.some(value => value.stacktrace?.frames?.length)) {
        return true;
      }
    }

    if (entry.type === EntryType.THREADS) {
      if (entry.data.values?.some(thread => thread.stacktrace?.frames?.length)) {
        return true;
      }
    }
  }

  return false;
}

export const useAiConfig = (
  group: Group,
  event: Event | undefined | null,
  project: Project
) => {
  const organization = useOrganization();
  const {data: autofixSetupData, isPending: isAutofixSetupLoading} = useAutofixSetup({
    groupId: group.id,
  });

  const isSampleError = useIsSampleEvent();
  const hasStacktrace = event && hasStacktraceWithFrames(event);

  const issueTypeConfig = getConfigForIssueType(group, project);

  const areAiFeaturesAllowed =
    !organization.hideAiFeatures &&
    getRegionDataFromOrganization(organization)?.name !== 'de' &&
    organization.features.includes('gen-ai-features');

  const isSummaryEnabled = issueTypeConfig.issueSummary.enabled;
  const isAutofixEnabled = issueTypeConfig.autofix;
  const hasResources = issueTypeConfig.resources;

  const hasGenAIConsent = autofixSetupData?.genAIConsent.ok ?? organization.genAIConsent;

  const hasSummary = hasGenAIConsent && isSummaryEnabled && areAiFeaturesAllowed;
  const hasAutofix =
    isAutofixEnabled && areAiFeaturesAllowed && hasStacktrace && !isSampleError;

  const needsGenAIConsent =
    !hasGenAIConsent && (isSummaryEnabled || isAutofixEnabled) && areAiFeaturesAllowed;

  const needsAutofixSetup =
    isAutofixEnabled &&
    !isAutofixSetupLoading &&
    (!autofixSetupData?.genAIConsent.ok || !autofixSetupData?.integration.ok) &&
    areAiFeaturesAllowed;

  return {
    hasSummary,
    hasAutofix,
    needsGenAIConsent,
    needsAutofixSetup,
    hasResources,
    isAutofixSetupLoading,
  };
};
