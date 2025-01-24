import type {Project} from 'sentry/types/project';
import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import {ModuleName} from 'sentry/views/insights/types';

const excludedModuleNames = [
  ModuleName.OTHER,
  ModuleName.MOBILE_UI,
  ModuleName.MOBILE_SCREENS,
  ModuleName.CRONS,
  ModuleName.UPTIME,
] as const;

type ExcludedModuleNames = (typeof excludedModuleNames)[number];

const modulePropertyMap: Record<
  Exclude<ModuleName, ExcludedModuleNames>,
  keyof Project
> = {
  [ModuleName.HTTP]: 'hasInsightsHttp',
  [ModuleName.DB]: 'hasInsightsDb',
  [ModuleName.CACHE]: 'hasInsightsCaches',
  [ModuleName.VITAL]: 'hasInsightsVitals',
  [ModuleName.QUEUE]: 'hasInsightsQueues',
  [ModuleName.SCREEN_LOAD]: 'hasInsightsScreenLoad',
  [ModuleName.APP_START]: 'hasInsightsAppStart',
  // Renamed resource to assets
  [ModuleName.RESOURCE]: 'hasInsightsAssets',
  [ModuleName.AI]: 'hasInsightsLlmMonitoring',
  [ModuleName.SCREEN_RENDERING]: 'hasInsightsScreenLoad', // Screen rendering and screen loads share similar spans
};

/**
 * Returns whether the module and current project selection has received a first insight span
 * @param module The name of the module that will be checked for a first span
 * @param projects The projects to check for the first span. If not provided, the selected projects will be used
 * @returns true if the module has a first span in the selected projects, false otherwise
 */
export function useHasFirstSpan(module: ModuleName, projects?: Project[]): boolean {
  const {projects: allProjects} = useProjects();
  const pageFilters = usePageFilters();

  // Unsupported modules. Remove MOBILE_UI from this list once released.
  if ((excludedModuleNames as readonly ModuleName[]).includes(module)) {
    return false;
  }

  if (projects) {
    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    return projects.some(p => p[modulePropertyMap[module]] === true);
  }

  let selectedProjects: Project[] = [];
  // There are three cases for the selected pageFilter projects:
  //  - [] empty list represents "My Projects"
  //  - [-1] represents "All Projects"
  //  - [.., ..] otherwise, represents a list of project IDs
  if (pageFilters.selection.projects.length === 0 && isActiveSuperuser()) {
    selectedProjects = allProjects; // when superuser is enabled, My Projects isn't applicable, and in reality all projects are selected when projects.length === 0
  }
  if (pageFilters.selection.projects.length === 0) {
    selectedProjects = allProjects.filter(p => p.isMember);
  } else if (
    pageFilters.selection.projects.length === 1 &&
    pageFilters.selection.projects[0] === -1
  ) {
    selectedProjects = allProjects;
  } else {
    selectedProjects = allProjects.filter(p =>
      pageFilters.selection.projects.includes(parseInt(p.id, 10))
    );
  }

  // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
  return selectedProjects.some(p => p[modulePropertyMap[module]] === true);
}
