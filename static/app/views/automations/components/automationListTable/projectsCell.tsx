import {Placeholder} from 'sentry/components/placeholder';
import {ProjectList} from 'sentry/components/projectList';
import {EmptyCell} from 'sentry/components/workflowEngine/gridCell/emptyCell';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import type {Automation} from 'sentry/types/workflowEngine/automations';
import {defined} from 'sentry/utils';
import {useDetectorDataContext} from 'sentry/views/automations/components/automationListTable/detectorDataContext';

export function ProjectsCell({automation}: {automation: Automation}) {
  const detectorData = useDetectorDataContext();

  if (!detectorData || detectorData.isPending) {
    return <Placeholder height="20px" />;
  }

  const projectIds = [
    ...new Set(
      automation.detectorIds
        .map(id => detectorData.detectorsById.get(id)?.projectId)
        .filter(defined)
    ),
  ];

  const projectSlugs = projectIds
    .map(projectId => ProjectsStore.getById(projectId)?.slug)
    .filter(defined);

  if (projectSlugs.length === 0) {
    return <EmptyCell />;
  }

  return <ProjectList projectSlugs={projectSlugs} />;
}
