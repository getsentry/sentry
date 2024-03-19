import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {AiSuggestedSolution} from 'sentry/components/events/aiSuggestedSolution';
import {Autofix} from 'sentry/components/events/autofix';
import {EventDataSection} from 'sentry/components/events/eventDataSection';
import {Resources} from 'sentry/components/events/interfaces/performance/resources';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {EntryType, type Event, type Group, type Project} from 'sentry/types';
import {
  getConfigForIssueType,
  shouldShowCustomErrorResourceConfig,
} from 'sentry/utils/issueTypeConfig';
import useOrganization from 'sentry/utils/useOrganization';

type Props = {
  event: Event;
  group: Group;
  project: Project;
};

// This section provides users with resources and maybe solutions on how to resolve an issue
export function ResourcesAndMaybeSolutions({event, project, group}: Props) {
  const organization = useOrganization();
  const config = getConfigForIssueType(group, project);

  const hasStacktrace = event.entries.some(
    entry => entry.type === EntryType.EXCEPTION || entry.type === EntryType.STACKTRACE
  );

  // NOTE:  Autofix is for INTERNAL testing only for now.
  const displayAiAutofix =
    project.features.includes('ai-autofix') &&
    organization.features.includes('issue-details-autofix-ui') &&
    !shouldShowCustomErrorResourceConfig(group, project) &&
    config.autofix &&
    hasStacktrace;
  const displayAiSuggestedSolution =
    // Skip showing AI suggested solution if the issue has a custom resource
    organization.aiSuggestedSolution &&
    !shouldShowCustomErrorResourceConfig(group, project) &&
    !displayAiAutofix;

  if (!config.resources && !(displayAiSuggestedSolution || displayAiAutofix)) {
    return null;
  }

  return (
    <Wrapper
      type="resources-and-maybe-solutions"
      title={t('Resources and Maybe Solutions')}
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
