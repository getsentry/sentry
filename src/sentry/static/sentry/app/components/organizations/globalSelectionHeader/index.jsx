import {flatten, isEqual, pick, partition} from 'lodash';
import {withRouter} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {DATE_TIME_KEYS, URL_PARAM} from 'app/constants/globalSelectionHeader';
import {DEFAULT_STATS_PERIOD} from 'app/constants';
import {callIfFunction} from 'app/utils/callIfFunction';
import {isEqualWithDates} from 'app/utils/isEqualWithDates';
import {t} from 'app/locale';
import {
  updateDateTime,
  updateEnvironments,
  updateParams,
  updateParamsWithoutHistory,
  updateProjects,
} from 'app/actionCreators/globalSelection';
import BackToIssues from 'app/components/organizations/backToIssues';
import ConfigStore from 'app/stores/configStore';
import HeaderItemPosition from 'app/components/organizations/headerItemPosition';
import HeaderSeparator from 'app/components/organizations/headerSeparator';
import InlineSvg from 'app/components/inlineSvg';
import MultipleEnvironmentSelector from 'app/components/organizations/multipleEnvironmentSelector';
import MultipleProjectSelector from 'app/components/organizations/multipleProjectSelector';
import SentryTypes from 'app/sentryTypes';
import TimeRangeSelector from 'app/components/organizations/timeRangeSelector';
import Tooltip from 'app/components/tooltip';
import space from 'app/styles/space';
import withGlobalSelection from 'app/utils/withGlobalSelection';
import withProjects from 'app/utils/withProjects';

import {getStateFromQuery} from './utils';
import Header from './header';

function getProjectIdFromProject(project) {
  return parseInt(project.id, 10);
}

class GlobalSelectionHeader extends React.Component {
  static propTypes = {
    organization: SentryTypes.Organization,
    router: PropTypes.object,

    /**
     * List of projects to display in project selector
     */
    projects: PropTypes.arrayOf(SentryTypes.Project).isRequired,

    /**
     * A project will be forced from parent component (selection is disabled, and if user
     * does not have multi-project support enabled, it will not try to auto select a project).
     *
     * Project will be specified in the prop `forceProject` (since its data is async)
     */
    shouldForceProject: PropTypes.bool,

    /**
     * If a forced project is passed, selection is disabled
     */
    forceProject: SentryTypes.Project,

    /**
     * Currently selected values(s)
     */
    selection: SentryTypes.GlobalSelection,

    /**
     * Display Environment selector?
     */
    showEnvironmentSelector: PropTypes.bool,

    /**
     * Display Environment selector?
     */
    showDateSelector: PropTypes.bool,

    /**
     * Disable automatic routing
     */
    hasCustomRouting: PropTypes.bool,

    /**
     * Reset these URL params when we fire actions
     * (custom routing only)
     */
    resetParamsOnChange: PropTypes.arrayOf(PropTypes.string),

    /**
     * GlobalSelectionStore is not always initialized (e.g. Group Details) before this is rendered
     *
     * This component intentionally attempts to sync store --> URL Parameter
     * only when mounted, except when this prop changes.
     *
     * XXX: This comes from GlobalSelectionStore and currently does not reset,
     * so it happens at most once. Can add a reset as needed.
     */
    forceUrlSync: PropTypes.bool,

    /// Props passed to child components ///

    /**
     * Show absolute date selectors
     */
    showAbsolute: PropTypes.bool,
    /**
     * Show relative date selectors
     */
    showRelative: PropTypes.bool,

    // Callbacks //
    onChangeProjects: PropTypes.func,
    onUpdateProjects: PropTypes.func,
    onChangeEnvironments: PropTypes.func,
    onUpdateEnvironments: PropTypes.func,
    onChangeTime: PropTypes.func,
    onUpdateTime: PropTypes.func,
  };

  static defaultProps = {
    hasCustomRouting: false,
    showEnvironmentSelector: true,
    showDateSelector: true,
    resetParamsOnChange: [],
  };

  constructor(props) {
    super(props);
    this.state = {};
  }

  componentDidMount() {
    if (this.props.hasCustomRouting) {
      return;
    }

    const {
      location,
      params,
      organization,
      selection,
      shouldForceProject,
      forceProject,
    } = this.props;

    const hasMultipleProjectFeature = this.hasMultipleProjectSelection();

    const stateFromRouter = getStateFromQuery(location.query);
    // We should update store if there are any relevant URL parameters when component is mounted
    if (Object.values(stateFromRouter).some(i => !!i)) {
      if (!stateFromRouter.start && !stateFromRouter.end && !stateFromRouter.period) {
        stateFromRouter.period = DEFAULT_STATS_PERIOD;
      }
      const {project, environment, start, end, period, utc} = stateFromRouter;

      // This will update store with values from URL parameters
      updateDateTime({start, end, period, utc});

      // environment/project here can be null i.e. if only period is set in url params
      updateEnvironments(environment || []);

      const requestedProjects = project || [];

      if (hasMultipleProjectFeature) {
        updateProjects(requestedProjects);
      } else {
        this.enforceSingleProject({requestedProjects, shouldForceProject, forceProject});
      }
    } else if (params && params.orgId === organization.slug) {
      // Otherwise, if organization has NOT changed,
      // we can update URL with values from store
      //
      // e.g. when switching to a new view that uses this component,
      // update URL parameters to reflect current store
      const {datetime, environments, projects} = selection;
      const otherParams = {environment: environments, ...datetime};

      if (hasMultipleProjectFeature || projects.length === 1) {
        updateParamsWithoutHistory({project: projects, ...otherParams}, this.getRouter());
      } else {
        this.enforceSingleProject({shouldForceProject, forceProject}, otherParams);
      }
    }
  }

  shouldComponentUpdate(nextProps, nextState) {
    // Update if state changes
    if (this.state !== nextState) {
      return true;
    }

    // Update if URL parameters change
    if (this.changedQueryKeys(this.props, nextProps).length > 0) {
      return true;
    }

    // Update if `forceProject` changes
    if (this.props.forceProject !== nextProps.forceProject) {
      return true;
    }

    const nonDateKeys = ['projects', 'environments'];
    // Update if selection values change
    if (
      !isEqual(
        pick(this.props.selection, nonDateKeys),
        pick(nextProps.selection, nonDateKeys)
      ) ||
      !isEqualWithDates(
        pick(this.props.selection.datetime, DATE_TIME_KEYS),
        pick(nextProps.selection.datetime, DATE_TIME_KEYS)
      )
    ) {
      return true;
    }

    // update if any projects are starred or reordered
    if (
      this.props.projects &&
      nextProps.projects &&
      !isEqual(
        this.props.projects.map(p => [p.slug, p.isBookmarked]),
        nextProps.projects.map(p => [p.slug, p.isBookmarked])
      )
    ) {
      return true;
    }

    // Update if `forceUrlSync` changes
    if (!this.props.forceUrlSync && nextProps.forceUrlSync) {
      return true;
    }

    return false;
  }

  componentDidUpdate(prevProps) {
    const {
      hasCustomRouting,
      location,
      selection,
      forceUrlSync,
      forceProject,
    } = this.props;

    if (hasCustomRouting) {
      return;
    }

    // This means that previously forceProject was falsey (e.g. loading) and now
    // we have the project to force.
    //
    // If user does not have multiple project selection, we need to save the forced
    // project into the store (if project is not in URL params), otherwise
    // there will be weird behavior in this component since it just picks a project
    if (!this.hasMultipleProjectSelection() && forceProject && !prevProps.forceProject) {
      // Make sure a project isn't specified in query param already, since it should take precendence
      const {project} = getStateFromQuery(location.query);
      if (!project) {
        this.enforceSingleProject({forceProject});
      }
    }

    if (forceUrlSync && !prevProps.forceUrlSync) {
      const {project, environment} = getStateFromQuery(location.query);

      if (
        !isEqual(project, selection.projects) ||
        !isEqual(environment, selection.environments)
      ) {
        updateParamsWithoutHistory(
          {
            project: selection.projects,
            environment: selection.environments,
          },
          this.getRouter()
        );
      }
    }

    // If component has updated (e.g. due to re-render from a router action),
    // update store values with values from router. Router should be source of truth
    this.updateStoreIfChange(prevProps, this.props);
  }

  hasMultipleProjectSelection = () => {
    return new Set(this.props.organization.features).has('global-views');
  };

  /**
   * If user does not have access to `global-views` (e.g. multi project select), then
   * we update URL params with 1) `props.forceProject`, 2) requested projects from URL params,
   * 3) first project user is a member of from org
   */
  enforceSingleProject = (
    {requestedProjects, shouldForceProject, forceProject} = {},
    otherParams
  ) => {
    let newProject;

    // This is the case where we *want* to force project, but we are still loading
    // the forced project's details
    if (shouldForceProject && !forceProject) {
      return;
    }

    if (forceProject) {
      // this takes precendence over the other options
      newProject = [getProjectIdFromProject(forceProject)];
    } else if (requestedProjects && requestedProjects.length > 0) {
      // If there is a list of projects from URL params, select first project from that list
      newProject = [requestedProjects[0]];
    } else {
      // Otherwise, get first project from org that the user is a member of
      newProject = this.getFirstProject();
    }

    updateProjects(newProject);
    updateParamsWithoutHistory({project: newProject, ...otherParams}, this.getRouter());
  };

  /**
   * Identifies the query params (that are relevant to this component) that have changed
   *
   * @return {String[]} Returns an array of param keys that have changed
   */
  changedQueryKeys = (prevProps, nextProps) => {
    const urlParamKeys = Object.values(URL_PARAM);
    const prevQuery = pick(prevProps.location.query, urlParamKeys);
    const nextQuery = pick(nextProps.location.query, urlParamKeys);

    // If no next query is specified keep the previous global selection values
    if (Object.keys(prevQuery).length === 0 && Object.keys(nextQuery).length === 0) {
      return [];
    }

    const changedKeys = Object.values(urlParamKeys).filter(
      key => !isEqual(prevQuery[key], nextQuery[key])
    );

    return changedKeys;
  };

  updateStoreIfChange = (prevProps, nextProps) => {
    // Don't do anything if query parameters have not changed
    //
    // e.g. if selection store changed, don't trigger more actions
    // to update global selection store (otherwise we'll get recursive updates)
    const changedKeys = this.changedQueryKeys(prevProps, nextProps);

    if (!changedKeys.length) {
      return;
    }

    const {project, environment, period, start, end, utc} = getStateFromQuery(
      nextProps.location.query
    );

    if (changedKeys.includes(URL_PARAM.PROJECT)) {
      updateProjects(project || []);
    }
    if (changedKeys.includes(URL_PARAM.ENVIRONMENT)) {
      updateEnvironments(environment || []);
    }
    if (
      [URL_PARAM.START, URL_PARAM.END, URL_PARAM.UTC, URL_PARAM.PERIOD].find(key =>
        changedKeys.includes(key)
      )
    ) {
      updateDateTime({start, end, period, utc});
    }
  };

  // Returns `router` from props if `hasCustomRouting` property is false
  getRouter = () => (!this.props.hasCustomRouting ? this.props.router : null);

  // Returns an options object for `update*` actions
  getUpdateOptions = () =>
    !this.props.hasCustomRouting
      ? {
          resetParams: this.props.resetParamsOnChange,
        }
      : {};

  handleChangeProjects = projects => {
    this.setState({
      projects,
    });
    callIfFunction(this.props.onChangeProjects, projects);
  };

  handleChangeEnvironments = environments => {
    this.setState({
      environments,
    });
    callIfFunction(this.props.onChangeEnvironments, environments);
  };

  handleChangeTime = ({start, end, relative: period, utc}) => {
    callIfFunction(this.props.onChangeTime, {start, end, period, utc});
  };

  handleUpdateTime = ({relative: period, start, end, utc} = {}) => {
    const newValueObj = {
      period,
      start,
      end,
      utc,
    };

    updateDateTime(newValueObj, this.getRouter(), this.getUpdateOptions());
    callIfFunction(this.props.onUpdateTime, newValueObj);
  };

  handleUpdateEnvironmments = () => {
    const {environments} = this.state;
    updateEnvironments(environments, this.getRouter(), this.getUpdateOptions());
    this.setState({environments: null});
    callIfFunction(this.props.onUpdateEnvironments, environments);
  };

  handleUpdateProjects = () => {
    const {projects} = this.state;

    // Clear environments when switching projects
    //
    // Update both params at once, otherwise:
    // - if you update projects first, we could get a flicker
    //   because you'll have projects & environments before we update
    // - if you update environments first, there could be race conditions
    //   with value of router.location.query
    updateParams(
      {
        environment: null,
        project: projects,
      },
      this.getRouter(),
      this.getUpdateOptions()
    );
    this.setState({projects: null, environments: null});
    callIfFunction(this.props.onUpdateProjects, projects);
  };

  getProjects = () => {
    const {organization, projects} = this.props;
    const {isSuperuser} = ConfigStore.get('user');
    const isOrgAdmin = new Set(organization.access).has('org:admin');

    const [memberProjects, nonMemberProjects] = partition(
      projects,
      project => project.isMember
    );

    if (isSuperuser || isOrgAdmin) {
      return [memberProjects, nonMemberProjects];
    }

    return [memberProjects, []];
  };

  getFirstProject = () => {
    return flatten(this.getProjects())
      .map(getProjectIdFromProject)
      .slice(0, 1);
  };

  getBackButton = () => {
    const {organization, location} = this.props;
    return (
      <BackButtonWrapper>
        <Tooltip title={t('Back to Issues Stream')} position="bottom">
          <BackToIssues
            to={`/organizations/${organization.slug}/issues/${location.search}`}
          >
            <InlineSvg src="icon-arrow-left" />
          </BackToIssues>
        </Tooltip>
      </BackButtonWrapper>
    );
  };

  render() {
    const {
      className,
      shouldForceProject,
      forceProject,
      organization,
      showAbsolute,
      showRelative,
      showDateSelector,
      showEnvironmentSelector,
    } = this.props;
    const {period, start, end, utc} = this.props.selection.datetime || {};

    const selectedProjects = forceProject
      ? [parseInt(forceProject.id, 10)]
      : this.props.selection.projects;

    const [projects, nonMemberProjects] = this.getProjects();

    return (
      <Header className={className}>
        <HeaderItemPosition>
          {shouldForceProject && this.getBackButton()}
          <MultipleProjectSelector
            organization={organization}
            shouldForceProject={shouldForceProject}
            forceProject={forceProject}
            projects={projects}
            nonMemberProjects={nonMemberProjects}
            value={this.state.projects || this.props.selection.projects}
            onChange={this.handleChangeProjects}
            onUpdate={this.handleUpdateProjects}
            multi={this.hasMultipleProjectSelection()}
          />
        </HeaderItemPosition>

        {showEnvironmentSelector && (
          <React.Fragment>
            <HeaderSeparator />
            <HeaderItemPosition>
              <MultipleEnvironmentSelector
                organization={organization}
                selectedProjects={selectedProjects}
                value={this.state.environments || this.props.selection.environments}
                onChange={this.handleChangeEnvironments}
                onUpdate={this.handleUpdateEnvironmments}
              />
            </HeaderItemPosition>
          </React.Fragment>
        )}

        {showDateSelector && (
          <React.Fragment>
            <HeaderSeparator />
            <HeaderItemPosition>
              <TimeRangeSelector
                key={`period:${period}-start:${start}-end:${end}-utc:${utc}`}
                showAbsolute={showAbsolute}
                showRelative={showRelative}
                relative={period}
                start={start}
                end={end}
                utc={utc}
                onChange={this.handleChangeTime}
                onUpdate={this.handleUpdateTime}
                organization={organization}
              />
            </HeaderItemPosition>
          </React.Fragment>
        )}

        {!showEnvironmentSelector && <HeaderItemPosition isSpacer />}
        {!showDateSelector && <HeaderItemPosition isSpacer />}
      </Header>
    );
  }
}

export default withProjects(withRouter(withGlobalSelection(GlobalSelectionHeader)));

const BackButtonWrapper = styled('div')`
  display: flex;
  align-items: center;
  height: 100%;
  position: relative;
  left: ${space(2)};
`;
