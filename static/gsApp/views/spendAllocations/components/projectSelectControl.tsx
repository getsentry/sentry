/**
 * MODIFIED FROM PROJECT QUOTA FORM
 */

import {useMemo} from 'react';

import SelectControl, {
  type ControlProps,
} from 'sentry/components/forms/controls/selectControl';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {t} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import useProjects from 'sentry/utils/useProjects';

type Props = {
  disabled: boolean;
  filteredIdList: string[];
  onChange: ControlProps['onChange'];
  value: string; // project ID
};

function ProjectSelectControl({
  disabled,
  onChange,
  value: valueProp,
  filteredIdList = [],
}: Props) {
  const {projects} = useProjects();
  const options = useMemo(() => {
    const myProjects: Project[] = [];
    const allProjects: Project[] = [];
    projects.forEach(project => {
      if (filteredIdList.indexOf(project.id) < 0) {
        project.isMember ? myProjects.push(project) : allProjects.push(project);
      }
    });
    return [
      {
        label: t('My Projects'),
        options: myProjects.map(p => ({
          value: p.id,
          textValue: p.slug,
          label: <ProjectBadge project={p} avatarSize={20} disableLink />,
          project: p,
        })),
      },
      {
        label: t('All Projects'),
        options: allProjects.map(p => ({
          value: p.id,
          textValue: p.slug,
          label: <ProjectBadge project={p} avatarSize={20} disableLink />,
          project: p,
        })),
      },
    ];
  }, [projects, filteredIdList]);

  return (
    <SelectControl
      placeholder={t('Select a project to continue')}
      name="projectSlug"
      disabled={disabled}
      options={options}
      value={valueProp}
      onChange={onChange}
      maxMenuWidth={250}
    />
  );
}

export default ProjectSelectControl;
