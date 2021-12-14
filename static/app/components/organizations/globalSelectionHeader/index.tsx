import {useEffect, useRef} from 'react';
import {withRouter, WithRouterProps} from 'react-router';
import isEqual from 'lodash/isEqual';
import partition from 'lodash/partition';

import {
  initializeUrlState,
  updateDateTime,
  updateEnvironments,
  updateProjects,
} from 'sentry/actionCreators/globalSelection';
import {DATE_TIME_KEYS} from 'sentry/constants/pageFilters';
import ConfigStore from 'sentry/stores/configStore';
import useProjects from 'sentry/utils/useProjects';
import withOrganization from 'sentry/utils/withOrganization';

import GlobalSelectionHeader from './globalSelectionHeader';
import {getStateFromQuery} from './utils';

const getDateObjectFromQuery = (query: Record<string, any>) =>
  Object.fromEntries(
    Object.entries(query).filter(([key]) => DATE_TIME_KEYS.includes(key))
  );

type GlobalSelectionHeaderProps = Omit<
  React.ComponentPropsWithoutRef<typeof GlobalSelectionHeader>,
  | 'router'
  | 'memberProjects'
  | 'nonMemberProjects'
  | 'selection'
  | 'projects'
  | 'loadingProjects'
>;

type Props = WithRouterProps &
  GlobalSelectionHeaderProps & {
    /**
     * Skip loading from local storage
     * An example is Issue Details, in the case where it is accessed directly (e.g. from email).
     * We do not want to load the user's last used env/project in this case, otherwise will
     * lead to very confusing behavior.
     */
    skipLoadLastUsed?: boolean;
  };

function GlobalSelectionHeaderContainer({skipLoadLastUsed, ...props}: Props) {
  const {
    location,
    router,
    forceProject,
    organization,
    defaultSelection,
    showAbsolute,
    shouldForceProject,
    specificProjectSlugs,
  } = props;

  const {projects, initiallyLoaded: projectsLoaded} = useProjects();

  const {isSuperuser} = ConfigStore.get('user');
  const isOrgAdmin = organization.access.includes('org:admin');
  const enforceSingleProject = !organization.features.includes('global-views');

  const specifiedProjects = specificProjectSlugs
    ? projects.filter(project => specificProjectSlugs.includes(project.slug))
    : projects;

  const [memberProjects, otherProjects] = partition(
    specifiedProjects,
    project => project.isMember
  );

  const nonMemberProjects = isSuperuser || isOrgAdmin ? otherProjects : [];

  const additionalProps = {
    loadingProjects: !projectsLoaded,
    projects,
    memberProjects,
    nonMemberProjects,
  };

  // Initializes GlobalSelectionHeader
  //
  // Calls an actionCreator to load project/environment from local storage if possible,
  // otherwise populate with defaults.
  //
  // This should only happen when the header is mounted
  // e.g. when changing views or organizations.
  useEffect(() => {
    // We can initialize before ProjectsStore is fully loaded if we don't need to
    // enforce single project.
    if (!projectsLoaded && (shouldForceProject || enforceSingleProject)) {
      return;
    }

    initializeUrlState({
      organization,
      queryParams: location.query,
      router,
      skipLoadLastUsed,
      memberProjects,
      defaultSelection,
      forceProject,
      shouldForceProject,
      shouldEnforceSingleProject: enforceSingleProject,
      showAbsolute,
    });
  }, [projectsLoaded, shouldForceProject, enforceSingleProject]);

  const lastQuery = useRef(location.query);

  // This happens e.g. using browser's navigation button, in which case
  // we need to update our store to reflect URL changes
  useEffect(() => {
    if (location.query === lastQuery.current) {
      return;
    }

    const oldQuery = getStateFromQuery(lastQuery.current, {
      allowEmptyPeriod: true,
    });
    const newQuery = getStateFromQuery(location.query, {
      allowEmptyPeriod: true,
    });

    const newEnvironments = newQuery.environment || [];
    const newDateObject = getDateObjectFromQuery(newQuery);
    const oldDateObject = getDateObjectFromQuery(oldQuery);

    /**
     * Do not pass router to these actionCreators, as we do not want to update
     * routes since these state changes are happening due to a change of routes
     */
    if (!isEqual(oldQuery.project, newQuery.project)) {
      updateProjects(newQuery.project || [], null, {environments: newEnvironments});
    } else if (!isEqual(oldQuery.environment, newQuery.environment)) {
      /**
       * When the project stays the same, it's still possible that the environment
       * changed, so explictly update the enviornment
       */
      updateEnvironments(newEnvironments);
    }

    if (!isEqual(oldDateObject, newDateObject)) {
      updateDateTime(newDateObject);
    }

    lastQuery.current = location.query;
  }, [location.query]);

  return <GlobalSelectionHeader {...props} {...additionalProps} />;
}

export default withOrganization(withRouter(GlobalSelectionHeaderContainer));
