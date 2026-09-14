import styled from '@emotion/styled';

import {Container, type ContainerProps} from '@sentry/scraps/layout';

import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {agentMonitoringPlatforms} from 'sentry/data/platformCategories';
import {pulsingIndicatorStyles} from 'sentry/styles/pulsingIndicator';
import {getSelectedProjectList} from 'sentry/utils/project/useSelectedProjectsHaveField';
import {useProjects} from 'sentry/utils/useProjects';

export function useOnboardingProject() {
  const {projects} = useProjects();
  const pageFilters = usePageFilters();
  const selectedProjects = getSelectedProjectList(
    pageFilters.selection.projects,
    projects
  );
  const agentMonitoringProjects = selectedProjects.filter(p =>
    agentMonitoringPlatforms.has(p.platform!)
  );

  if (agentMonitoringProjects.length > 0) {
    return agentMonitoringProjects[0];
  }
  return selectedProjects[0];
}

export const PulseSpacer = styled('div')`
  height: ${p => p.theme.space['3xl']};
`;

export const PulsingIndicator = styled('div')`
  ${pulsingIndicatorStyles};
  flex-shrink: 0;
`;

export function HeaderText(props: ContainerProps) {
  return <Container flex={{zero: 1, xl: 0.65}} {...props} />;
}

export const SubTitle = styled('div')`
  margin-bottom: ${p => p.theme.space.md};
`;

export const BulletList = styled('ul')`
  list-style-type: disc;
  padding-left: 20px;
  margin-bottom: ${p => p.theme.space.xl};

  li {
    margin-bottom: ${p => p.theme.space.md};
  }
`;
