import {Fragment, useEffect, useLayoutEffect, useRef} from 'react';
import isEqual from 'lodash/isEqual';

import type {InitializeUrlStateParams} from 'sentry/actionCreators/pageFilters';
import {
  initializeUrlState,
  updateDateTime,
  updateEnvironments,
  updatePersistence,
  updateProjects,
} from 'sentry/actionCreators/pageFilters';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {SIDEBAR_NAVIGATION_SOURCE} from 'sentry/components/sidebar/utils';
import {DEFAULT_STATS_PERIOD} from 'sentry/constants';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import useRouter from 'sentry/utils/useRouter';
import {useUser} from 'sentry/utils/useUser';

import {getDatetimeFromState, getStateFromQuery} from './parse';

type InitializeUrlStateProps = Omit<
  InitializeUrlStateParams,
  | 'memberProjects'
  | 'nonMemberProjects'
  | 'queryParams'
  | 'router'
  | 'shouldEnforceSingleProject'
  | 'organization'
>;

interface Props extends InitializeUrlStateProps {
  children?: React.ReactNode;
  /**
   * When true, changes to page filters' value won't be saved to local storage, and will
   * be forgotten when the user navigates to a different page. This is useful for local
   * filtering contexts like in Dashboard Details.
   */
  disablePersistence?: boolean;
  /**
   * Slugs of projects to display in project selector
   */
  specificProjectSlugs?: string[];
  /**
   * If provided, will store page filters separately from the rest of Sentry
   */
  storageNamespace?: string;
}

/**
 * The page filters container handles initialization of page filters for the
 * wrapped content. Children will not be rendered until the filters are ready.
 */
function PageFiltersContainer({
  skipLoadLastUsed,
  skipLoadLastUsedEnvironment,
  maxPickableDays,
  children,
  ...props
}: Props) {
  const {
    forceProject,
    defaultSelection,
    showAbsolute,
    shouldForceProject,
    specificProjectSlugs,
    skipInitializeUrlParams,
    disablePersistence,
    storageNamespace,
  } = props;
  const router = useRouter();
  const location = useLocation();
  const organization = useOrganization();

  const {isReady} = usePageFilters();

  const {projects, initiallyLoaded: projectsLoaded} = useProjects();

  const enforceSingleProject = !organization.features.includes('global-views');

  const specifiedProjects = specificProjectSlugs
    ? projects.filter(project => specificProjectSlugs.includes(project.slug))
    : projects;

  const user = useUser();
  const memberProjects = user.isSuperuser
    ? specifiedProjects
    : specifiedProjects.filter(project => project.isMember);
  const nonMemberProjects = user.isSuperuser
    ? []
    : specifiedProjects.filter(project => !project.isMember);

  const doInitialization = () => {
    initializeUrlState({
      organization,
      queryParams: location.query,
      router,
      skipLoadLastUsed,
      skipLoadLastUsedEnvironment,
      maxPickableDays,
      memberProjects,
      nonMemberProjects,
      defaultSelection,
      forceProject,
      shouldForceProject,
      shouldEnforceSingleProject: enforceSingleProject,
      shouldPersist: !disablePersistence,
      showAbsolute,
      skipInitializeUrlParams,
      storageNamespace,
    });
  };

  // Initializes GlobalSelectionHeader
  //
  // Calls an actionCreator to load project/environment from local storage when
  // pinned, otherwise populate with defaults.
  //
  // This happens when we mount the container.
  useLayoutEffect(() => {
    if (!projectsLoaded) {
      return;
    }

    doInitialization();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectsLoaded]);

  // Update store persistence when `disablePersistence` changes
  useEffect(() => updatePersistence(!disablePersistence), [disablePersistence]);

  const lastQuery = useRef(location.query);

  // This happens e.g. using browser's navigation button, in which case
  // we need to update our store to reflect URL changes
  useLayoutEffect(() => {
    if (location.query === lastQuery.current) {
      return;
    }

    // We may need to re-initialize the URL state if we completely clear
    // out the global selection URL state, for example by navigating with
    // the sidebar on the same view.
    if (location.state?.source === SIDEBAR_NAVIGATION_SOURCE) {
      doInitialization();
      lastQuery.current = location.query;
      return;
    }

    const oldState = getStateFromQuery(lastQuery.current, {
      allowEmptyPeriod: true,
      allowAbsoluteDatetime: true,
    });
    const newState = getStateFromQuery(location.query, {
      allowAbsoluteDatetime: true,
      defaultStatsPeriod: defaultSelection?.datetime?.period ?? DEFAULT_STATS_PERIOD,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.query]);

  // Wait for global selection to be ready before rendering children
  // TODO: Not waiting for projects to be ready but initializing the correct page filters
  // would speed up orgs with tons of projects
  if (!isReady) {
    return (
      <Layout.Page withPadding>
        <LoadingIndicator />
      </Layout.Page>
    );
  }

  return <Fragment>{children}</Fragment>;
}

export default PageFiltersContainer;
