import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {AiSuggestedSolution} from 'sentry/components/events/aiSuggestedSolution';
import {EventDataSection} from 'sentry/components/events/eventDataSection';
import {Resources} from 'sentry/components/events/interfaces/performance/resources';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Event, Group, Project} from 'sentry/types';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';
import useOrganization from 'sentry/utils/useOrganization';

type Props = {
  event: Event;
  group: Group;
  projectSlug: Project['slug'];
};

// This section provides users with resources and maybe solutions on how to resolve an issue
export function ResourcesAndMaybeSolutions({event, projectSlug, group}: Props) {
  const organization = useOrganization();
  const config = getConfigForIssueType(group);

  if (!config.resources && !organization.features.includes('open-ai-suggestion')) {
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
          <Resources eventPlatform={event.platform} configResources={config.resources} />
        )}
        <AiSuggestedSolution event={event} projectSlug={projectSlug} />
      </Content>
    </Wrapper>
  );
}

const Content = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(3)};
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
