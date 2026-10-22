import {useContext, useEffect} from 'react';

import type {Organization} from 'sentry/types/organization';
import {useDetailedProject} from 'sentry/utils/project/useDetailedProject';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useParams} from 'sentry/utils/useParams';
import {useProjects} from 'sentry/utils/useProjects';
import {ProjectRouteContext} from 'sentry/views/projects/projectRouteContext';
import {SettingsNavigation} from 'sentry/views/settings/components/settingsNavigation';
import {getNavigationConfiguration} from 'sentry/views/settings/project/navigationConfiguration';
import {useSettingsV3} from 'sentry/views/settings/useSettingsV3';

interface ProjectSettingsNavigationProps {
  organization: Organization;
}

export function ProjectSettingsNavigation({
  organization,
}: ProjectSettingsNavigationProps) {
  const projectFromContext = useContext(ProjectRouteContext);
  const {projectId} = useParams<{projectId?: string}>();
  const settingsV3 = useSettingsV3();
  const navigate = useNavigate();
  const location = useLocation();
  const showAllProjects =
    settingsV3 &&
    !projectId &&
    new URLSearchParams(location.search).get('view') === 'all';
  const {projects} = useProjects({
    slugs: projectId ? [projectId] : settingsV3 ? undefined : [],
  });
  const firstProjectSlug = projects[0]?.slug;
  useEffect(() => {
    if (settingsV3 && !projectId && !showAllProjects && firstProjectSlug) {
      navigate(
        normalizeUrl(`/settings/${organization.slug}/projects/${firstProjectSlug}/`),
        {replace: true}
      );
    }
  }, [
    settingsV3,
    projectId,
    showAllProjects,
    firstProjectSlug,
    navigate,
    organization.slug,
  ]);
  const summaryProject = projects.find(({slug}) => slug === projectId);
  const {data: detailedProject} = useDetailedProject(
    {orgSlug: organization.slug, projectSlug: projectId ?? ''},
    {enabled: !!projectId && !projectFromContext}
  );
  const project = projectFromContext ?? detailedProject ?? summaryProject;

  return (
    <SettingsNavigation
      navigationObjects={
        settingsV3 && !projectId
          ? []
          : getNavigationConfiguration({
              project,
              organization,
              debugFilesNeedsReview: false,
            })
      }
      access={new Set(organization.access)}
      features={new Set(organization.features)}
      organization={organization}
      project={project}
      hookConfigs={[]}
      hooks={[]}
    />
  );
}
