import {Placeholder} from 'sentry/components/placeholder';
import {ProjectList} from 'sentry/components/projectList';
import {EmptyCell} from 'sentry/components/workflowEngine/gridCell/emptyCell';
import type {Automation} from 'sentry/types/workflowEngine/automations';
import {useAutomationProjectSlugs} from 'sentry/views/automations/hooks/utils';

export function ProjectsCell({automation}: {automation: Automation}) {
  const {projectSlugs, isLoading: isProjectsLoading} =
    useAutomationProjectSlugs(automation);

  if (isProjectsLoading) {
    return <Placeholder height="20px" />;
  }

  if (projectSlugs.length === 0) {
    return <EmptyCell />;
  }

  return <ProjectList projectSlugs={projectSlugs} />;
}
