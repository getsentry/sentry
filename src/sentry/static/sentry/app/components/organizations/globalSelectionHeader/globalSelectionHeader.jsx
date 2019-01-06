import {pick, isEqual} from 'lodash';
import {withRouter} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';

import {
  DATE_TIME_KEYS,
  URL_PARAM,
} from 'app/components/organizations/globalSelectionHeader/constants';
import {callIfFunction} from 'app/utils/callIfFunction';
import {defined} from 'app/utils';
import {getLocalDateObject} from 'app/utils/dates';
import {isEqualWithDates} from 'app/utils/isEqualWithDates';
import {
  updateDateTime,
  updateEnvironments,
  updateParams,
  updateProjects,
} from 'app/actionCreators/globalSelection';
import Header from 'app/components/organizations/header';
import HeaderItemPosition from 'app/components/organizations/headerItemPosition';
import HeaderSeparator from 'app/components/organizations/headerSeparator';
import MultipleEnvironmentSelector from 'app/components/organizations/multipleEnvironmentSelector';
import MultipleProjectSelector from 'app/components/organizations/multipleProjectSelector';
import SentryTypes from 'app/sentryTypes';
import TimeRangeSelector from 'app/components/organizations/timeRangeSelector';
import withGlobalSelection from 'app/utils/withGlobalSelection';

class GlobalSelectionHeader extends React.Component {
  static propTypes = {
    organization: SentryTypes.Organization,
    router: PropTypes.object,

    /**
     * List of projects to display in project selector
     */
    projects: PropTypes.arrayOf(SentryTypes.Project),

    /**
     * Currently selected values(s)
     */
    selection: SentryTypes.GlobalSelection,

    // Display Environment selector?
    showEnvironmentSelector: PropTypes.bool,

    // Disable automatic routing
    hasCustomRouting: PropTypes.bool,

    // Reset these URL params when we fire actions
    // (custom routing only)
    resetParamsOnChange: PropTypes.arrayOf(PropTypes.string),

    // Props passed to child components //
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
    resetParamsOnChange: [],
  };

  // Parses URL query parameters for values relevant to global selection header
  static getStateFromRouter(props) {
    const {query} = props.location;
    let start = query[URL_PARAM.START] !== 'null' && query[URL_PARAM.START];
    let end = query[URL_PARAM.END] !== 'null' && query[URL_PARAM.END];
    let project = query[URL_PARAM.PROJECT];
    let environment = query[URL_PARAM.ENVIRONMENT];
    let period = query[URL_PARAM.PERIOD];
    let utc = query[URL_PARAM.UTC];

    const hasAbsolute = !!start && !!end;

    if (defined(project) && Array.isArray(project)) {
      project = project.map(p => parseInt(p, 10));
    } else if (defined(project)) {
      const projectIdInt = parseInt(project, 10);
      project = isNaN(projectIdInt) ? [] : [projectIdInt];
    }

    if (defined(environment) && !Array.isArray(environment)) {
      environment = [environment];
    }

    if (hasAbsolute) {
      start = getLocalDateObject(start);
      end = getLocalDateObject(end);
    }

    return {
      project,
      environment,
      period: period || null,
      start: start || null,
      end: end || null,

      // params from URL will be a string
      utc: typeof utc !== 'undefined' ? utc === 'true' : null,
    };
  }

  constructor(props) {
    super(props);
    this.state = {};
  }

  componentDidMount() {
    if (this.props.hasCustomRouting) {
      return;
    }

    const stateFromRouter = GlobalSelectionHeader.getStateFromRouter(this.props);
    // We should update store if there are any relevant URL parameters when component
    // is mounted
    if (Object.values(stateFromRouter).some(i => !!i)) {
      const {project, environment, start, end, period, utc} = stateFromRouter;

      // This will update store with values from URL parameters
      updateDateTime({start, end, period, utc});

      // environment/project here can be null i.e. if only period is set in url params
      updateEnvironments(environment || []);
      updateProjects(project || []);
    } else {
      // Otherwise, we can update URL with values from store
      //
      // e.g. when switching to a new view that uses this component,
      // update URL parameters to reflect current store
      const {datetime, environments, projects} = this.props.selection;
      updateParams(
        {project: projects, environment: environments, ...datetime},
        this.getRouter()
      );
    }
  }

  shouldComponentUpdate(nextProps, nextState) {
    // Update if state changes
    if (this.state !== nextState) {
      return true;
    }

    // Update if URL parameters change
    if (this.didQueryChange(this.props, nextProps)) {
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

    return false;
  }

  componentDidUpdate(prevProps) {
    if (this.props.hasCustomRouting) {
      return;
    }

    // If component has updated (e.g. due to re-render from a router action),
    // update store values with values from router. Router should be source of truth
    this.updateStoreIfChange(prevProps, this.props);
  }

  didQueryChange = (prevProps, nextProps) => {
    const urlParamKeys = Object.values(URL_PARAM);
    return !isEqual(
      pick(prevProps.location.query, urlParamKeys),
      pick(nextProps.location.query, urlParamKeys)
    );
  };

  updateStoreIfChange = (prevProps, nextProps) => {
    // Don't do anything if query parameters have not changed
    //
    // e.g. if selection store changed, don't trigger more actions
    // to update global selection store (otherwise we'll get recursive updates)
    if (!this.didQueryChange(prevProps, nextProps)) {
      return;
    }

    const {
      project,
      environment,
      period,
      start,
      end,
      utc,
    } = GlobalSelectionHeader.getStateFromRouter(nextProps);

    if (start || end || period || utc) {
      // Don't attempt to update date if all of these values are empty
      updateDateTime({start, end, period, utc});
    }

    updateEnvironments(environment || []);
    updateProjects(project || []);
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
      ...(defined(period) ? {period} : {start, end}),
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
    updateProjects(projects, this.getRouter(), this.getUpdateOptions());
    this.setState({projects: null});
    callIfFunction(this.props.onUpdateProjects, projects);
  };

  getProjects = () => {
    return (
      this.props.projects ||
      this.props.organization.projects.filter(project => project.isMember)
    );
  };

  render() {
    const {
      className,
      organization,
      showAbsolute,
      showRelative,
      showEnvironmentSelector,
    } = this.props;
    const {period, start, end, utc} = this.props.selection.datetime || {};

    return (
      <Header className={className}>
        <HeaderItemPosition>
          <MultipleProjectSelector
            organization={organization}
            projects={this.getProjects()}
            value={this.state.projects || this.props.selection.projects}
            onChange={this.handleChangeProjects}
            onUpdate={this.handleUpdateProjects}
          />
        </HeaderItemPosition>

        {showEnvironmentSelector && (
          <React.Fragment>
            <HeaderSeparator />
            <HeaderItemPosition>
              <MultipleEnvironmentSelector
                organization={organization}
                value={this.state.environments || this.props.selection.environments}
                onChange={this.handleChangeEnvironments}
                onUpdate={this.handleUpdateEnvironmments}
              />
            </HeaderItemPosition>
          </React.Fragment>
        )}

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
          />
        </HeaderItemPosition>
      </Header>
    );
  }
}
export default withRouter(withGlobalSelection(GlobalSelectionHeader));
