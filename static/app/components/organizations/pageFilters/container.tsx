import {Fragment, useEffect, useRef} from 'react';
import {withRouter, WithRouterProps} from 'react-router';
import isEqual from 'lodash/isEqual';
import partition from 'lodash/partition';

import {
  initializeUrlState,
  updateDateTime,
  updateEnvironments,
  updateProjects,
} from 'sentry/actionCreators/pageFilters';
import DesyncedFilterAlert from 'sentry/components/organizations/pageFilters/desyncedFiltersAlert';
import ConfigStore from 'sentry/stores/configStore';
import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {PageContent} from 'sentry/styles/organization';
import useProjects from 'sentry/utils/useProjects';
import withOrganization from 'sentry/utils/withOrganization';

import GlobalSelectionHeader from './globalSelectionHeader';
import {getDatetimeFromState, getStateFromQuery} from './parse';

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
     * Hide the global header
     * Mainly used for pages which are using the new style page filters
     */
    hideGlobalHeader?: boolean;
    /**
     * Skip loading from local storage
     * An example is Issue Details, in the case where it is accessed directly (e.g. from email).
     * We do not want to load the user's last used env/project in this case, otherwise will
     * lead to very confusing behavior.
     */
    skipLoadLastUsed?: boolean;
  };

/**
 * The page filters container handles initalization of page filters for the
 * wrapped content. Children will not be rendered until the filters are ready.
 */
function Container({skipLoadLastUsed, children, ...props}: Props) {
  const {
    location,
    router,
    forceProject,
    organization,
    defaultSelection,
    showAbsolute,
    shouldForceProject,
    specificProjectSlugs,
    hideGlobalHeader,
  } = props;

  const {isReady} = useLegacyStore(PageFiltersStore);

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
  // Calls an actionCreator to load project/environment from local storage when
  // pinned, otherwise populate with defaults.
  //
  // This should only happen when the header is mounted e.g. when changing
  // views or organizations.
  useEffect(() => {
    // We can initialize before ProjectsStore is fully loaded if we don't need to
    // enforce single project.
    if (!projectsLoaded && (shouldForceProject || enforceSingleProject)) {
      return;
    }

    initializeUrlState({
      organization,
      queryParams: location.query,
      pathname: location.pathname,
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

    const oldState = getStateFromQuery(lastQuery.current, {
      allowEmptyPeriod: true,
      allowAbsoluteDatetime: true,
    });
    const newState = getStateFromQuery(location.query, {
      allowEmptyPeriod: true,
      allowAbsoluteDatetime: true,
    });

    const newEnvironments = newState.environment || [];
    const newDateState = getDatetimeFromState(newState);
    const oldDateState = getDatetimeFromState(oldState);

    const noProjectChange = isEqual(oldState.project, newState.project);
    const noEnvironmentChange = isEqual(oldState.environment, newState.environment);
    const noDatetimeChange = isEqual(oldDateState, newDateState);

    // Do not pass router to these actionCreators, as we do not want to update
    // routes since these state changes are happening due to a change of routes
    if (!noProjectChange) {
      updateProjects(newState.project || [], null, {environments: newEnvironments});
    }

    // When the project stays the same, it's still possible that the
    // environment changed, so explicitly update the environment
    if (noProjectChange && !noEnvironmentChange) {
      updateEnvironments(newEnvironments);
    }

    if (!noDatetimeChange) {
      updateDateTime(newDateState);
    }

    lastQuery.current = location.query;
  }, [location.query]);

  // Wait for global selection to be ready before rendering chilren
  if (!isReady) {
    return <PageContent />;
  }

  return (
    <Fragment>
      {!hideGlobalHeader && <GlobalSelectionHeader {...props} {...additionalProps} />}
      {hideGlobalHeader && <DesyncedFilterAlert router={router} />}
      {children}
    </Fragment>
  );
}

const PageFiltersContainer = withOrganization(withRouter(Container));

export default PageFiltersContainer;
