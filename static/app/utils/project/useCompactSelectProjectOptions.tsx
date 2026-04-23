import {useMemo} from 'react';

import {ProjectAvatar} from '@sentry/scraps/avatar';
import type {SelectOption, SelectOptionOrSection} from '@sentry/scraps/compactSelect';

import {t} from 'sentry/locale';
import type {Project} from 'sentry/types/project';

const toProjectOption = (project: Project): SelectOption<string> => ({
  value: project.id,
  label: project.slug,
  leadingItems: <ProjectAvatar project={project} />,
});

export function useCompactSelectProjectOptions({
  projects,
}: {
  projects: Project[];
}): Array<SelectOptionOrSection<string>> {
  return useMemo(() => {
    if (projects.length > 100) {
      // SelectSections disable virtualized rendering in CompactSelect, so after
      // a certain point we gotta skip them and render one big list.
      return projects.map(toProjectOption);
    }

    const myProjects = new Set<SelectOption<string>>();
    const otherProjects = new Set<SelectOption<string>>();
    for (const project of projects) {
      if (project.isMember) {
        myProjects.add(toProjectOption(project));
      } else {
        otherProjects.add(toProjectOption(project));
      }
    }

    if (otherProjects.size === 0) {
      return Array.from(myProjects.values());
    }
    return [
      {
        key: 'my-projects',
        label: t('My Projects'),
        options: Array.from(myProjects.values()),
      },
      {
        key: 'other-projects',
        label: t('Other Projects'),
        options: Array.from(otherProjects.values()),
      },
    ];
  }, [projects]);
}
