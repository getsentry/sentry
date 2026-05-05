import {useContext} from 'react';

import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {useDetailedProject} from 'sentry/utils/project/useDetailedProject';
import {useParams} from 'sentry/utils/useParams';
import {useProjects} from 'sentry/utils/useProjects';
import {ProjectRouteContext} from 'sentry/views/projects/projectRouteContext';
import {SettingsNavigation} from 'sentry/views/settings/components/settingsNavigation';
import {getNavigationConfiguration} from 'sentry/views/settings/project/navigationConfiguration';

interface ProjectSettingsNavigationProps {
  organization: Organization;
  project?: Project;
}

export function ProjectSettingsNavigation({
  organization,
  project: projectProp,
}: ProjectSettingsNavigationProps) {
  const projectFromContext = useContext(ProjectRouteContext);
  const {projectId} = useParams<{projectId?: string}>();
  const {projects} = useProjects({slugs: projectId ? [projectId] : []});
  const summaryProject = projects.find(({slug}) => slug === projectId);
  const {data: detailedProject} = useDetailedProject(
    {orgSlug: organization.slug, projectSlug: projectId ?? ''},
    {enabled: !!projectId && !projectProp && !projectFromContext}
  );
  const project = projectProp ?? projectFromContext ?? detailedProject ?? summaryProject;

  return (
    <SettingsNavigation
      navigationObjects={getNavigationConfiguration({
        project,
        organization,
        debugFilesNeedsReview: false,
      })}
      access={new Set(organization.access)}
      features={new Set(organization.features)}
      organization={organization}
      project={project}
    />
  );
}
