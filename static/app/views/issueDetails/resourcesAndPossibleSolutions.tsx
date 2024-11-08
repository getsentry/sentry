import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {Resources} from 'sentry/components/events/interfaces/performance/resources';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';
import {useHasStreamlinedUI} from 'sentry/views/issueDetails/utils';

type Props = {
  event: Event;
  group: Group;
  project: Project;
};

// This section provides users with resources and possible solutions on how to resolve an issue
export function ResourcesAndPossibleSolutions({event, project, group}: Props) {
  const config = getConfigForIssueType(group, project);
  const isSelfHostedErrorsOnly = ConfigStore.get('isSelfHostedErrorsOnly');
  const hasStreamlinedUI = useHasStreamlinedUI();

  if (isSelfHostedErrorsOnly || !config.resources || hasStreamlinedUI) {
    return null;
  }

  return (
    <Wrapper
      title={t('Resources and Possible Solutions')}
      configResources={!!config.resources}
      type={SectionKey.RESOURCES}
    >
      <Content>
        <Resources
          eventPlatform={event.platform}
          groupId={group.id}
          configResources={config.resources}
        />
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
