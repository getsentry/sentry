import {useEffect, useState} from 'react';
import styled from '@emotion/styled';

import {Container, type ContainerProps} from '@sentry/scraps/layout';

import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {agentMonitoringPlatforms} from 'sentry/data/platformCategories';
import {pulsingIndicatorStyles} from 'sentry/styles/pulsingIndicator';
import type {Project} from 'sentry/types/project';
import {getSelectedProjectList} from 'sentry/utils/project/useSelectedProjectsHaveField';
import {useProjects} from 'sentry/utils/useProjects';
import {useSpans} from 'sentry/views/insights/common/queries/useDiscover';

export function useSpanWaiter({
  project,
  search,
  referrer,
}: {
  project: Project;
  referrer: string;
  search: string;
}) {
  const {selection} = usePageFilters();
  const [shouldRefetch, setShouldRefetch] = useState(true);

  const request = useSpans(
    {
      search,
      fields: ['id'],
      limit: 1,
      useQueryOptions: {
        refetchInterval: shouldRefetch ? 5000 : undefined,
      },
      pageFilters: {
        ...selection,
        projects: [Number(project.id)],
        datetime: {
          period: '6h',
          utc: true,
          start: null,
          end: null,
        },
      },
    },
    referrer
  );

  const hasEvents = Boolean(request.data?.length);

  useEffect(() => {
    if (hasEvents && shouldRefetch) {
      // oxlint-disable-next-line react/set-state-in-effect
      setShouldRefetch(false);
    }
  }, [hasEvents, shouldRefetch]);

  return request;
}

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
