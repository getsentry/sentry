import styled from '@emotion/styled';

import {Link} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {t, tct, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Project} from 'sentry/types/project';

const MAX_TOOLTIP_PROJECTS = 2;

export function TeamProjectsCell({
  projects,
  teamProjectsUrl,
}: {
  projects: Project[];
  teamProjectsUrl: string;
}) {
  if (projects.length === 0) {
    return <Text variant="muted">{t('No projects')}</Text>;
  }

  const tooltipProjects = projects.slice(0, MAX_TOOLTIP_PROJECTS);
  const remainingCount = projects.length - MAX_TOOLTIP_PROJECTS;

  const projectNames = tooltipProjects.map(p => p.slug).join(', ');
  const tooltipContent =
    remainingCount > 0
      ? tct('[projects] and [count] more', {
          projects: projectNames,
          count: remainingCount,
        })
      : projectNames;

  return (
    <Tooltip title={tooltipContent}>
      <ProjectsLink to={teamProjectsUrl}>
        {tn('%s project', '%s projects', projects.length)}
      </ProjectsLink>
    </Tooltip>
  );
}

const ProjectsLink = styled(Link)`
  display: flex;
  align-items: center;
  gap: ${space(1)};
  position: relative;
  z-index: 1;
  white-space: nowrap;
  color: ${p => p.theme.tokens.content.primary};

  &:hover {
    color: ${p => p.theme.tokens.content.primary};
    text-decoration: underline;
  }
`;
