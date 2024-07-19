import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {AiSuggestedSolution} from 'sentry/components/events/aiSuggestedSolution';
import {Autofix} from 'sentry/components/events/autofix';
import {EventDataSection} from 'sentry/components/events/eventDataSection';
import {Resources} from 'sentry/components/events/interfaces/performance/resources';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {space} from 'sentry/styles/space';
import {EntryType, type Event, type Group, type Project} from 'sentry/types';
import {
  getConfigForIssueType,
  shouldShowCustomErrorResourceConfig,
} from 'sentry/utils/issueTypeConfig';
import {getRegionDataFromOrganization} from 'sentry/utils/regions';
import useOrganization from 'sentry/utils/useOrganization';

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

// This section provides users with resources and possible solutions on how to resolve an issue
export function ResourcesAndPossibleSolutions({event, project, group}: Props) {
  const organization = useOrganization();
  const config = getConfigForIssueType(group, project);
  const isSelfHostedErrorsOnly = ConfigStore.get('isSelfHostedErrorsOnly');

  // NOTE:  Autofix is for INTERNAL testing only for now.
  const displayAiAutofix =
    project.features.includes('ai-autofix') &&
    organization.features.includes('issue-details-autofix-ui') &&
    !shouldShowCustomErrorResourceConfig(group, project) &&
    config.autofix &&
    hasStacktraceWithFrames(event);
  const displayAiSuggestedSolution =
    // Skip showing AI suggested solution if the issue has a custom resource
    organization.aiSuggestedSolution &&
    getRegionDataFromOrganization(organization)?.name !== 'de' &&
    !shouldShowCustomErrorResourceConfig(group, project) &&
    !displayAiAutofix;

  if (
    isSelfHostedErrorsOnly ||
    (!config.resources && !(displayAiSuggestedSolution || displayAiAutofix))
  ) {
    return null;
  }

  return (
    <Wrapper
      type="resources-and-possible-solutions"
      title={t('Resources and Possible Solutions')}
      configResources={!!config.resources}
    >
      <Content>
        {config.resources && (
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

const Wrapper = styled(EventDataSection)<{configResources: boolean}>`
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
