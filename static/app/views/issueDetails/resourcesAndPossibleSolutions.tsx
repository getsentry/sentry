import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {AiSuggestedSolution} from 'sentry/components/events/aiSuggestedSolution';
import {Autofix} from 'sentry/components/events/autofix';
import {Resources} from 'sentry/components/events/interfaces/performance/resources';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {space} from 'sentry/styles/space';
import {EntryType, type Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {
  getConfigForIssueType,
  shouldShowCustomErrorResourceConfig,
} from 'sentry/utils/issueTypeConfig';
import {getRegionDataFromOrganization} from 'sentry/utils/regions';
import useOrganization from 'sentry/utils/useOrganization';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';
import {useHasStreamlinedUI, useIsSampleEvent} from 'sentry/views/issueDetails/utils';

type Props = {
  event: Event;
  group: Group;
  project: Project;
};

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

const shouldDisplayAiAutofixForOrganization = (organization: Organization) => {
  return (
    ((organization.features.includes('autofix') &&
      organization.features.includes('issue-details-autofix-ui')) ||
      organization.genAIConsent) &&
    !organization.hideAiFeatures &&
    getRegionDataFromOrganization(organization)?.name !== 'de'
  );
};

const shouldDisplayAiSuggestedSolutionForOrganization = (organization: Organization) => {
  return (
    organization.aiSuggestedSolution &&
    !organization.hideAiFeatures &&
    getRegionDataFromOrganization(organization)?.name !== 'de'
  );
};

// This section provides users with resources and possible solutions on how to resolve an issue
export function ResourcesAndPossibleSolutions({event, project, group}: Props) {
  const organization = useOrganization();
  const config = getConfigForIssueType(group, project);
  const isSelfHostedErrorsOnly = ConfigStore.get('isSelfHostedErrorsOnly');
  const isSampleError = useIsSampleEvent();
  const hasStreamlinedUI = useHasStreamlinedUI();

  const displayAiAutofix =
    shouldDisplayAiAutofixForOrganization(organization) &&
    config.autofix &&
    !shouldShowCustomErrorResourceConfig(group, project) &&
    hasStacktraceWithFrames(event) &&
    !isSampleError;

  const displayAiSuggestedSolution =
    shouldDisplayAiSuggestedSolutionForOrganization(organization) &&
    config.aiSuggestedSolution &&
    getRegionDataFromOrganization(organization)?.name !== 'de' &&
    // Skip showing AI suggested solution if the issue has a custom resource
    !shouldShowCustomErrorResourceConfig(group, project) &&
    !displayAiAutofix &&
    !isSampleError;

  if (isSelfHostedErrorsOnly || hasStreamlinedUI) {
    return null;
  }

  return (
    <Wrapper
      title={t('Resources and Possible Solutions')}
      configResources={!!config.resources}
      type={SectionKey.RESOURCES}
    >
      <Content>
        {config.resources && !hasStreamlinedUI && (
          <Resources
            eventPlatform={event.platform}
            groupId={group.id}
            configResources={config.resources}
          />
        )}
        {displayAiSuggestedSolution && (
          <AiSuggestedSolution event={event} projectSlug={project.slug} />
        )}
        {displayAiAutofix && <Autofix event={event} group={group} />}
      </Content>
    </Wrapper>
  );
}

const Content = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
`;

const Wrapper = styled(InterimSection)<{configResources: boolean}>`
  @media (min-width: ${p => p.theme.breakpoints.xlarge}) {
    ${p =>
      !p.configResources &&
      css`
        && {
          padding-top: ${space(3)};
        }
      `}
  }
`;
