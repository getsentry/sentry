import {WithRouterProps} from 'react-router/lib/withRouter';
import PropTypes from 'prop-types';
import * as React from 'react';
import debounce from 'lodash/debounce';
import styled from '@emotion/styled';

import {DEFAULT_STATS_PERIOD} from 'app/constants';
import {
  GlobalSelection,
  Environment,
  Organization,
  MinimalProject,
  Project,
} from 'app/types';
import {PageContent} from 'app/styles/organization';
import {callIfFunction} from 'app/utils/callIfFunction';
import {t} from 'app/locale';
import {
  updateDateTime,
  updateEnvironments,
  updateProjects,
} from 'app/actionCreators/globalSelection';
import BackToIssues from 'app/components/organizations/backToIssues';
import HeaderItemPosition from 'app/components/organizations/headerItemPosition';
import HeaderSeparator from 'app/components/organizations/headerSeparator';
import {IconArrow} from 'app/icons';
import MultipleEnvironmentSelector from 'app/components/organizations/multipleEnvironmentSelector';
import MultipleProjectSelector from 'app/components/organizations/multipleProjectSelector';
import Projects from 'app/utils/projects';
import SentryTypes from 'app/sentryTypes';
import TimeRangeSelector from 'app/components/organizations/timeRangeSelector';
import Tooltip from 'app/components/tooltip';
import space from 'app/styles/space';
import withGlobalSelection from 'app/utils/withGlobalSelection';

import Header from './header';

const PROJECTS_PER_PAGE = 50;

const defaultProps = {
  /**
   * Disable automatic routing
   */
  hasCustomRouting: false,

  /**
   * Display Environment selector?
   */
  showEnvironmentSelector: true,

  /**
   * Display date selector?
   */
  showDateSelector: true,

  /**
   * Reset these URL params when we fire actions
   * (custom routing only)
   */
  resetParamsOnChange: [],

  /**
   * Remove ability to select multiple projects even if organization has feature 'global-views'
   */
  disableMultipleProjectSelection: false,
};

type Props = {
  children?: React.ReactNode; // TODO(discoverv1): This should be required when discoverv1 is removed
  organization: Organization;

  memberProjects: Project[];
  nonMemberProjects: Project[];

  /**
   * List of projects to display in project selector (comes from HoC)
   */
  projects: Project[];

  /**
   * Currently selected values(s)
   */
  selection: GlobalSelection;

  /**
   * Custom default selection values (e.g. a different default period)
   */
  defaultSelection?: Partial<GlobalSelection>;

  /**
   * Is global selection store still loading (i.e. not ready)
   */
  isGlobalSelectionReady?: boolean;

  /**
   * Whether or not the projects are currently being loaded in
   */
  loadingProjects: boolean;

  className?: string;

  /**
   * Slugs of projects to display in project selector (this affects the ^^^projects returned from HoC)
   */
  specificProjectSlugs?: string[];

  /**
   * A project will be forced from parent component (selection is disabled, and if user
   * does not have multi-project support enabled, it will not try to auto select a project).
   *
   * Project will be specified in the prop `forceProject` (since its data is async)
   */
  shouldForceProject?: boolean;

  /**
   * If a forced project is passed, selection is disabled
   */
  forceProject?: MinimalProject | null;

  /// Props passed to child components ///

  /**
   * Show absolute date selectors
   */
  showAbsolute?: boolean;
  /**
   * Show relative date selectors
   */
  showRelative?: boolean;

  /**
   * Small info icon with tooltip hint text
   */
  timeRangeHint?: string;

  // Callbacks //
  onChangeProjects?: (val: number[]) => void;
  onUpdateProjects?: () => void;
  onChangeEnvironments?: (environments: Environment[]) => void;
  onUpdateEnvironments?: (environments: Environment[]) => void;
  onChangeTime?: (datetime: any) => void;
  onUpdateTime?: (datetime: any) => void;

  /**
   * If true, there will be a back to issues stream icon link
   */
  showIssueStreamLink?: boolean;

  /**
   * If true, there will be a project settings icon link
   * (forceProject prop needs to be present to know the right project slug)
   */
  showProjectSettingsLink?: boolean;

  /**
   * Subject that will be used in a tooltip that is shown on a lock icon hover
   * E.g. This 'issue' is unique to a project
   */
  lockedMessageSubject?: string;

  /**
   * Message to display at the bottom of project list
   */
  projectsFooterMessage?: React.ReactNode;
} & Partial<typeof defaultProps> &
  Omit<WithRouterProps, 'router'> & {
    router: WithRouterProps['router'] | null;
  };

type State = {
  projects: number[] | null;
  environments: Environment[] | null;
  searchQuery: string;
};

class GlobalSelectionHeader extends React.Component<Props, State> {
  static propTypes: any = {
    organization: SentryTypes.Organization,
    router: PropTypes.object,
    projects: PropTypes.arrayOf(SentryTypes.Project).isRequired,

    memberProjects: PropTypes.arrayOf(SentryTypes.Project).isRequired,

    nonMemberProjects: PropTypes.arrayOf(SentryTypes.Project).isRequired,

    /**
     * Slugs of projects to display in project selector (this affects the ^^^projects returned from HoC)
     */
    specificProjectSlugs: PropTypes.arrayOf(PropTypes.string),
    disableMultipleProjectSelection: PropTypes.bool,
    isGlobalSelectionReady: PropTypes.bool,
    loadingProjects: PropTypes.bool,
    shouldForceProject: PropTypes.bool,
    forceProject: SentryTypes.Project,
    selection: SentryTypes.GlobalSelection,
    showEnvironmentSelector: PropTypes.bool,
    showDateSelector: PropTypes.bool,
    hasCustomRouting: PropTypes.bool,
    resetParamsOnChange: PropTypes.arrayOf(PropTypes.string),
    showAbsolute: PropTypes.bool,
    showRelative: PropTypes.bool,
    timeRangeHint: PropTypes.string,

    // Callbacks //
    onChangeProjects: PropTypes.func,
    onUpdateProjects: PropTypes.func,
    onChangeEnvironments: PropTypes.func,
    onUpdateEnvironments: PropTypes.func,
    onChangeTime: PropTypes.func,
    onUpdateTime: PropTypes.func,

    showIssueStreamLink: PropTypes.bool,
    showProjectSettingsLink: PropTypes.bool,
    lockedMessageSubject: PropTypes.string,
    projectsFooterMessage: PropTypes.node,
  };

  static defaultProps = defaultProps;

  state = {
    projects: null,
    environments: null,
    searchQuery: '',
  };

  hasMultipleProjectSelection = () =>
    new Set(this.props.organization.features).has('global-views');

  // Returns `router` from props if `hasCustomRouting` property is false
  getRouter = () => (!this.props.hasCustomRouting ? this.props.router : null);

  // Returns an options object for `update*` actions
  getUpdateOptions = () =>
    !this.props.hasCustomRouting
      ? {
          save: true,
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

  handleUpdateTime = ({
    relative: period,
    start,
    end,
    utc,
  }: {relative?; start?; end?; utc?} = {}) => {
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
    updateProjects(projects || [], this.getRouter(), {
      ...this.getUpdateOptions(),
      environments: [],
    });
    this.setState({projects: null, environments: null});
    callIfFunction(this.props.onUpdateProjects, projects);
  };

  getBackButton = () => {
    const {organization, location} = this.props;
    return (
      <BackButtonWrapper>
        <Tooltip title={t('Back to Issues Stream')} position="bottom">
          <BackToIssues
            data-test-id="back-to-issues"
            to={`/organizations/${organization.slug}/issues/${location.search}`}
          >
            <IconArrow direction="left" size="sm" />
          </BackToIssues>
        </Tooltip>
      </BackButtonWrapper>
    );
  };

  scrollFetchDispatcher = debounce(
    (onSearch, options) => {
      onSearch(this.state.searchQuery, options);
    },
    200,
    {leading: true, trailing: false}
  );

  searchDispatcher = debounce((onSearch, searchQuery, options) => {
    // in the case that a user repeats a search query (because search is
    // debounced this is possible if the user types and then deletes what they
    // typed) we should switch to an append strategy to not override all results
    // with a new page.
    if (this.state.searchQuery === searchQuery) {
      options.append = true;
    }
    onSearch(searchQuery, options);
    this.setState({
      searchQuery,
    });
  }, 200);

  render() {
    const {
      className,
      children,
      shouldForceProject,
      forceProject,
      isGlobalSelectionReady,
      loadingProjects,
      organization,
      showAbsolute,
      showRelative,
      showDateSelector,
      showEnvironmentSelector,
      memberProjects,
      nonMemberProjects,
      showIssueStreamLink,
      showProjectSettingsLink,
      lockedMessageSubject,
      timeRangeHint,
      specificProjectSlugs,
      disableMultipleProjectSelection,
      projectsFooterMessage,
      defaultSelection,
    } = this.props;

    const {period, start, end, utc} = this.props.selection.datetime || {};
    const defaultPeriod = defaultSelection?.datetime?.period || DEFAULT_STATS_PERIOD;

    const selectedProjects = forceProject
      ? [parseInt(forceProject.id, 10)]
      : this.props.selection.projects;

    return (
      <React.Fragment>
        <Header className={className}>
          <HeaderItemPosition>
            {showIssueStreamLink && this.getBackButton()}
            <Projects
              orgId={organization.slug}
              limit={PROJECTS_PER_PAGE}
              slugs={specificProjectSlugs}
            >
              {({projects, initiallyLoaded, hasMore, onSearch, fetching}) => {
                const paginatedProjectSelectorCallbacks = {
                  onScroll: ({clientHeight, scrollHeight, scrollTop}) => {
                    // check if no new projects are being fetched and the user has
                    // scrolled far enough to fetch a new page of projects
                    if (
                      !fetching &&
                      scrollTop + clientHeight >= scrollHeight - clientHeight &&
                      hasMore
                    ) {
                      this.scrollFetchDispatcher(onSearch, {append: true});
                    }
                  },
                  onFilterChange: event => {
                    this.searchDispatcher(onSearch, event.target.value, {
                      append: false,
                    });
                  },
                  searching: fetching,
                  paginated: true,
                };
                return (
                  <MultipleProjectSelector
                    organization={organization}
                    shouldForceProject={shouldForceProject}
                    forceProject={forceProject}
                    projects={loadingProjects ? projects : memberProjects}
                    isGlobalSelectionReady={isGlobalSelectionReady}
                    isLoadingProjects={!initiallyLoaded}
                    nonMemberProjects={nonMemberProjects}
                    value={this.state.projects || this.props.selection.projects}
                    onChange={this.handleChangeProjects}
                    onUpdate={this.handleUpdateProjects}
                    multi={
                      !disableMultipleProjectSelection &&
                      this.hasMultipleProjectSelection()
                    }
                    {...(loadingProjects ? paginatedProjectSelectorCallbacks : {})}
                    showIssueStreamLink={showIssueStreamLink}
                    showProjectSettingsLink={showProjectSettingsLink}
                    lockedMessageSubject={lockedMessageSubject}
                    footerMessage={projectsFooterMessage}
                  />
                );
              }}
            </Projects>
          </HeaderItemPosition>

          {showEnvironmentSelector && (
            <React.Fragment>
              <HeaderSeparator />
              <HeaderItemPosition>
                <MultipleEnvironmentSelector
                  organization={organization}
                  projects={this.props.projects}
                  loadingProjects={loadingProjects}
                  selectedProjects={selectedProjects}
                  value={this.props.selection.environments}
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
                  key={`period:${period}-start:${start}-end:${end}-utc:${utc}-defaultPeriod:${defaultPeriod}`}
                  showAbsolute={showAbsolute}
                  showRelative={showRelative}
                  relative={period}
                  start={start}
                  end={end}
                  utc={utc}
                  onChange={this.handleChangeTime}
                  onUpdate={this.handleUpdateTime}
                  organization={organization}
                  defaultPeriod={defaultPeriod}
                  hint={timeRangeHint}
                />
              </HeaderItemPosition>
            </React.Fragment>
          )}

          {!showEnvironmentSelector && <HeaderItemPosition isSpacer />}
          {!showDateSelector && <HeaderItemPosition isSpacer />}
        </Header>

        {isGlobalSelectionReady ? children : <PageContent />}
      </React.Fragment>
    );
  }
}

export default withGlobalSelection(GlobalSelectionHeader);

const BackButtonWrapper = styled('div')`
  display: flex;
  align-items: center;
  height: 100%;
  position: relative;
  left: ${space(2)};
`;
