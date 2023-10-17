import {Fragment, useEffect, useRef} from 'react';
import isEmpty from 'lodash/isEmpty';
import isEqual from 'lodash/isEqual';

import {
  initializeUrlState,
  InitializeUrlStateParams,
  updateDateTime,
  updateEnvironments,
  updatePersistence,
  updateProjects,
} from 'sentry/actionCreators/pageFilters';
import * as Layout from 'sentry/components/layouts/thirds';
import DesyncedFilterAlert from 'sentry/components/organizations/pageFilters/desyncedFiltersAlert';
import {DEFAULT_STATS_PERIOD} from 'sentry/constants';
import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import useRouter from 'sentry/utils/useRouter';
import withOrganization from 'sentry/utils/withOrganization';

import {getDatetimeFromState, getStateFromQuery} from './parse';
import {extractSelectionParameters} from './utils';

type InitializeUrlStateProps = Omit<
  InitializeUrlStateParams,
  | 'memberProjects'
  | 'nonMemberProjects'
  | 'queryParams'
  | 'router'
  | 'shouldEnforceSingleProject'
>;

interface Props extends InitializeUrlStateProps {
  children?: React.ReactNode;
  /**
   * Custom alert message for the desynced filter state.
   */
  desyncedAlertMessage?: string;
  /**
   * When true, changes to page filters' value won't be saved to local storage, and will
   * be forgotten when the user navigates to a different page. This is useful for local
   * filtering contexts like in Dashboard Details.
   */
  disablePersistence?: boolean;
  /**
   * Whether to hide the revert button in the desynced filter alert.
   */
  hideDesyncRevertButton?: boolean;
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
function Container({
  skipLoadLastUsed,
  skipLoadLastUsedEnvironment,
  children,
  ...props
}: Props) {
  const {
    forceProject,
    organization,
    defaultSelection,
    showAbsolute,
    shouldForceProject,
    specificProjectSlugs,
    skipInitializeUrlParams,
    disablePersistence,
    desyncedAlertMessage,
    hideDesyncRevertButton,
    storageNamespace,
  } = props;
  const router = useRouter();
  const location = useLocation();

  const {isReady} = usePageFilters();

  const {projects, initiallyLoaded: projectsLoaded} = useProjects();

  const enforceSingleProject = !organization.features.includes('global-views');

  const specifiedProjects = specificProjectSlugs
    ? projects.filter(project => specificProjectSlugs.includes(project.slug))
    : projects;

  const {user} = useLegacyStore(ConfigStore);
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
  useEffect(() => {
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
  useEffect(() => {
    if (location.query === lastQuery.current) {
      return;
    }

    // We may need to re-initialize the URL state if we completely clear
    // out the global selection URL state, for example by navigating with
    // the sidebar on the same view.
    const oldSelectionQuery = extractSelectionParameters(lastQuery.current);
    const newSelectionQuery = extractSelectionParameters(location.query);

    // XXX: This re-initialization is only required in new-page-filter
    // land, since we have implicit pinning in the old land which will
    // cause page filters to commonly reset.
    if (isEmpty(newSelectionQuery) && !isEqual(oldSelectionQuery, newSelectionQuery)) {
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
  if (!isReady) {
    return <Layout.Page withPadding />;
  }

  return (
    <Fragment>
      {!organization.features.includes('new-page-filter') && (
        <DesyncedFilterAlert
          router={router}
          message={desyncedAlertMessage}
          hideRevertButton={hideDesyncRevertButton}
        />
      )}
      {children}
    </Fragment>
  );
}

const PageFiltersContainer = withOrganization(Container);

export default PageFiltersContainer;
