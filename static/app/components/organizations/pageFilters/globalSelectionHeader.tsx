import * as React from 'react';
import {WithRouterProps} from 'react-router';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';

import {
  updateDateTime,
  updateEnvironments,
  updateProjects,
} from 'sentry/actionCreators/pageFilters';
import BackToIssues from 'sentry/components/organizations/backToIssues';
import HeaderItemPosition from 'sentry/components/organizations/headerItemPosition';
import HeaderSeparator from 'sentry/components/organizations/headerSeparator';
import MultipleEnvironmentSelector from 'sentry/components/organizations/multipleEnvironmentSelector';
import MultipleProjectSelector from 'sentry/components/organizations/multipleProjectSelector';
import TimeRangeSelector, {
  ChangeData,
} from 'sentry/components/organizations/timeRangeSelector';
import Tooltip from 'sentry/components/tooltip';
import {DEFAULT_STATS_PERIOD} from 'sentry/constants';
import {IconArrow} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {MinimalProject, Organization, PageFilters, Project} from 'sentry/types';
import {callIfFunction} from 'sentry/utils/callIfFunction';
import Projects from 'sentry/utils/projects';
import withPageFilters from 'sentry/utils/withPageFilters';

const PROJECTS_PER_PAGE = 50;

const defaultProps = {
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
  resetParamsOnChange: [] as string[],

  /**
   * Remove ability to select multiple projects even if organization has feature 'global-views'
   */
  disableMultipleProjectSelection: false,
};

type Props = {
  /**
   * Whether or not the projects are currently being loaded in
   */
  loadingProjects: boolean;

  memberProjects: Project[];
  nonMemberProjects: Project[];

  organization: Organization;

  /**
   * List of projects to display in project selector (comes from HoC)
   */
  projects: Project[];

  /**
   * Currently selected values(s)
   */
  selection: PageFilters;

  className?: string;

  /**
   * Custom default selection values (e.g. a different default period)
   */
  defaultSelection?: Partial<PageFilters>;

  /**
   * If a forced environment is passed, selection is disabled
   */
  forceEnvironment?: string;

  /**
   * If a forced project is passed, selection is disabled
   */
  forceProject?: MinimalProject | null;

  /**
   * Is global selection store still loading (i.e. not ready)
   */
  isGlobalSelectionReady?: boolean;

  /**
   * Subject that will be used in a tooltip that is shown on a lock icon hover
   * E.g. This 'issue' is unique to a project
   */
  lockedMessageSubject?: string;

  /**
   * The maximum number of days in the past you can pick
   */
  maxPickableDays?: number;

  onChangeEnvironments?: (environments: string[]) => void;
  // Callbacks //
  onChangeProjects?: (val: number[]) => void;

  onChangeTime?: (datetime: any) => void;

  onUpdateEnvironments?: (environments: string[]) => void;
  onUpdateProjects?: (selectedProjects: number[]) => void;
  onUpdateTime?: (datetime: any) => void;
  /**
   * Message to display at the bottom of project list
   */
  projectsFooterMessage?: React.ReactNode;
  /**
   * Override default relative date options from DEFAULT_RELATIVE_PERIODS
   */
  relativeDateOptions?: Record<string, React.ReactNode>;
  /**
   * A project will be forced from parent component (selection is disabled, and if user
   * does not have multi-project support enabled, it will not try to auto select a project).
   *
   * Project will be specified in the prop `forceProject` (since its data is async)
   */
  shouldForceProject?: boolean;

  /// Props passed to child components ///
  /**
   * Show absolute date selectors
   */
  showAbsolute?: boolean;

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
   * Show relative date selectors
   */
  showRelative?: boolean;

  /**
   * Slugs of projects to display in project selector
   */
  specificProjectSlugs?: string[];

  /**
   * Small info icon with tooltip hint text
   */
  timeRangeHint?: string;
} & Partial<typeof defaultProps> &
  Omit<WithRouterProps, 'router'> & {
    router: WithRouterProps['router'] | null;
  };

type State = {
  environments: string[] | null;
  projects: number[] | null;
  searchQuery: string;
};

class GlobalSelectionHeader extends React.Component<Props, State> {
  static defaultProps = defaultProps;

  state: State = {
    projects: null,
    environments: null,
    searchQuery: '',
  };

  // Returns an options object for `update*` actions
  getUpdateOptions = () => ({
    save: true,
    resetParams: this.props.resetParamsOnChange,
  });

  handleChangeProjects = (projects: State['projects']) => {
    this.setState({
      projects,
    });
    callIfFunction(this.props.onChangeProjects, projects);
  };

  handleChangeEnvironments = (environments: State['environments']) => {
    this.setState({
      environments,
    });
    callIfFunction(this.props.onChangeEnvironments, environments);
  };

  handleChangeTime = ({start, end, relative: period, utc}: ChangeData) => {
    callIfFunction(this.props.onChangeTime, {start, end, period, utc});
  };

  handleUpdateTime = ({
    relative: period,
    start,
    end,
    utc,
  }: {end?; relative?; start?; utc?} = {}) => {
    const newValueObj = {
      period,
      start,
      end,
      utc,
    };

    updateDateTime(newValueObj, this.props.router, this.getUpdateOptions());
    callIfFunction(this.props.onUpdateTime, newValueObj);
  };

  handleUpdateEnvironmments = () => {
    const {environments} = this.state;
    updateEnvironments(environments, this.props.router, this.getUpdateOptions());
    this.setState({environments: null});
    callIfFunction(this.props.onUpdateEnvironments, environments);
  };

  handleUpdateProjects = () => {
    const {projects} = this.state;

    // Clear environments when switching projects
    updateProjects(projects || [], this.props.router, {
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
      shouldForceProject,
      forceEnvironment,
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
      relativeDateOptions,
      maxPickableDays,
    } = this.props;

    const {period, start, end, utc} = this.props.selection.datetime || {};
    const defaultPeriod = defaultSelection?.datetime?.period || DEFAULT_STATS_PERIOD;

    const selectedProjects = forceProject
      ? [parseInt(forceProject.id, 10)]
      : this.props.selection.projects;

    return (
      <Header className={className}>
        <HeaderItemPosition>
          {showIssueStreamLink && this.getBackButton()}
          <Projects
            orgId={organization.slug}
            limit={PROJECTS_PER_PAGE}
            slugs={specificProjectSlugs}
          >
            {({projects, hasMore, onSearch, fetching}) => {
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
                  projects={loadingProjects ? (projects as Project[]) : memberProjects}
                  isGlobalSelectionReady={isGlobalSelectionReady}
                  nonMemberProjects={nonMemberProjects}
                  value={this.state.projects || this.props.selection.projects}
                  onChange={this.handleChangeProjects}
                  onUpdate={this.handleUpdateProjects}
                  disableMultipleProjectSelection={disableMultipleProjectSelection}
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
                forceEnvironment={forceEnvironment}
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
                relativeOptions={relativeDateOptions}
                maxPickableDays={maxPickableDays}
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

export default withPageFilters(GlobalSelectionHeader);

const BackButtonWrapper = styled('div')`
  display: flex;
  align-items: center;
  height: 100%;
  position: relative;
  left: ${space(2)};
`;

const Header = styled('div')`
  position: relative;
  display: flex;
  width: 100%;
  height: 60px;

  border-bottom: 1px solid ${p => p.theme.border};
  box-shadow: ${p => p.theme.dropShadowLight};
  z-index: ${p => p.theme.zIndex.globalSelectionHeader};

  background: ${p => p.theme.headerBackground};
  font-size: ${p => p.theme.fontSizeExtraLarge};
  @media (min-width: ${p => p.theme.breakpoints[0]} and max-width: ${p =>
      p.theme.breakpoints[1]}) {
    margin-top: 54px;
  }
  @media (max-width: calc(${p => p.theme.breakpoints[0]} - 1px)) {
    margin-top: 0;
  }
`;
