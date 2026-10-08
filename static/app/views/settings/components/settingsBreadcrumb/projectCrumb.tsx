import {ProjectAvatar} from '@sentry/scraps/avatar';

import {trackAnalytics} from 'sentry/utils/analytics';
import {replaceRouterParams} from 'sentry/utils/replaceRouterParams';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useParams} from 'sentry/utils/useParams';
import {useProjects} from 'sentry/utils/useProjects';
import type {SettingsBreadcrumbSelectorProps} from 'sentry/views/settings/components/settingsBreadcrumb/types';

import {SettingsBreadcrumbSelector} from './settingsBreadcrumbSelector';

export function ProjectCrumb({to, switchTo, children}: SettingsBreadcrumbSelectorProps) {
  const navigate = useNavigate();
  const {projects, onSearch} = useProjects();
  const params = useParams();
  const activeProject = projects.find(project => project.slug === params.projectId);

  return (
    <SettingsBreadcrumbSelector
      label={activeProject?.slug ?? params.projectId ?? ''}
      leadingGraphic={
        activeProject && <ProjectAvatar project={activeProject} size={16} />
      }
      hasMenu={projects && projects.length > 1}
      to={replaceRouterParams(to, params)}
      value={activeProject?.slug ?? ''}
      onCrumbSelect={projectSlug =>
        navigate(
          normalizeUrl(replaceRouterParams(switchTo, {...params, projectId: projectSlug}))
        )
      }
      onOpenChange={open => {
        if (open) {
          trackAnalytics('breadcrumbs.menu.opened', {organization: null});
        }
      }}
      search={{onChange: onSearch}}
      options={projects.map(project => ({
        value: project.slug,
        leadingItems: <ProjectAvatar project={project} size={20} />,
        label: project.slug,
      }))}
    >
      {children}
    </SettingsBreadcrumbSelector>
  );
}
