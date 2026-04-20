import {useMemo} from 'react';

import {ProjectAvatar} from '@sentry/scraps/avatar';
import type {SelectOption, SelectOptionOrSection} from '@sentry/scraps/compactSelect';

import {t} from 'sentry/locale';
import type {Project} from 'sentry/types/project';

const toProjectOptionWithAvatar = (project: Project): SelectOption<string> => ({
  value: project.id,
  label: project.slug,
  leadingItems: <ProjectAvatar project={project} />,
});

const toProjectOptionNoAvatar = (project: Project): SelectOption<string> => ({
  value: project.id,
  label: project.slug,
});

const makeMapper = (size: number) => {
  return size > 50 ? toProjectOptionNoAvatar : toProjectOptionWithAvatar;
};

export function useCompactSelectProjectOptions({
  projects,
}: {
  projects: Project[];
}): Array<SelectOptionOrSection<string>> {
  return useMemo(() => {
    const mapper = makeMapper(projects.length);

    const myProjects = new Set<Project>();
    const otherProjects = new Set<Project>();
    for (const project of projects) {
      if (project.isMember) {
        myProjects.add(project);
      } else {
        otherProjects.add(project);
      }
    }

    if (otherProjects.size === 0) {
      return Array.from(myProjects.values().map(mapper));
    }
    return [
      {
        key: 'my-projects',
        label: t('My Projects'),
        options: Array.from(myProjects.values().map(mapper)),
      },
      {
        key: 'other-projects',
        label: t('Other Projects'),
        options: Array.from(otherProjects.values().map(mapper)),
      },
    ];
  }, [projects]);
}
