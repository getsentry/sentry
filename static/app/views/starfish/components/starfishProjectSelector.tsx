import {useMemo, useState} from 'react';

import {updateProjects} from 'sentry/actionCreators/pageFilters';
import {CompactSelect} from 'sentry/components/compactSelect';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {t} from 'sentry/locale';
import {Project} from 'sentry/types';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import useRouter from 'sentry/utils/useRouter';
import {ALLOWED_PROJECT_IDS_FOR_ORG_SLUG} from 'sentry/views/starfish/allowedProjects';

export function StarfishProjectSelector() {
  const {projects, initiallyLoaded: projectsLoaded, fetchError} = useProjects();
  const organization = useOrganization();
  const router = useRouter();
  const {selection} = usePageFilters();

  const allowedProjectIDs: string[] = useMemo(
    () => ALLOWED_PROJECT_IDS_FOR_ORG_SLUG[organization.slug] ?? [],
    [organization.slug]
  );

  const [selectedProjectId, setSelectedProjectId] = useState(
    selection.projects[0] ?? allowedProjectIDs[0]
  );

  const currentProject = selection.projects[0] ?? allowedProjectIDs[0];
  if (selectedProjectId !== currentProject) {
    setSelectedProjectId(currentProject);
  }

  if (!projectsLoaded) {
    return (
      <CompactSelect
        disabled
        options={[{label: t('Loading\u2026'), value: 'loading'}]}
        defaultValue="loading"
      />
    );
  }

  if (fetchError) {
    throw new Error('Failed to fetch projects');
  }

  const projectOptions = projects
    .filter(project => allowedProjectIDs.includes(project.id))
    .map(project => ({
      label: <ProjectOptionLabel project={project} />,
      value: project.id,
    }))
    .sort((projectA, projectB) => Number(projectA.value) - Number(projectB.value));

  const handleProjectChange = option =>
    updateProjects([parseInt(option.value, 10)], router, {
      storageNamespace: 'starfish',
      save: true,
    });

  return (
    <CompactSelect
      menuWidth={250}
      options={projectOptions}
      value={String(selectedProjectId)}
      onChange={handleProjectChange}
    />
  );
}

function ProjectOptionLabel({project}: {project: Project}) {
  return <ProjectBadge project={project} avatarSize={20} disableLink />;
}
