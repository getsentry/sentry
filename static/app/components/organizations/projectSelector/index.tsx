import {PureComponent} from 'react';
import {withRouter, WithRouterProps} from 'react-router';
import {ClassNames} from '@emotion/react';
import styled from '@emotion/styled';
import sortBy from 'lodash/sortBy';

import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import Button from 'sentry/components/button';
import DropdownAutoComplete from 'sentry/components/dropdownAutoComplete';
import {MenuActions} from 'sentry/components/dropdownMenu';
import Link from 'sentry/components/links/link';
import HeaderItem from 'sentry/components/organizations/headerItem';
import PageFilterPinButton from 'sentry/components/organizations/pageFilters/pageFilterPinButton';
import PlatformList from 'sentry/components/platformList';
import Tooltip from 'sentry/components/tooltip';
import {ALL_ACCESS_PROJECTS} from 'sentry/constants/pageFilters';
import {IconAdd, IconProject} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import space from 'sentry/styles/space';
import {MinimalProject, Organization, Project} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import getRouteStringFromRoutes from 'sentry/utils/getRouteStringFromRoutes';
import theme from 'sentry/utils/theme';

import ProjectSelectorFooter from './footer';
import SelectorItem from './selectorItem';

type Props = WithRouterProps & {
  /**
   * Projects the member is a part of
   */
  memberProjects: Project[];
  /**
   * Projects the member is _not_ part of
   */
  nonMemberProjects: Project[];
  /**
   * Triggers any time a selection is changed, but the menu has not yet been closed or "applied"
   */
  onChange: (selected: number[]) => void;
  /**
   * Triggered when the selection changes are applied
   */
  onUpdate: (newProjects?: number[]) => void;
  organization: Organization;
  /**
   * The selected projects
   */
  value: number[];
  /**
   * Used to render a custom dropdown button for the DropdownAutoComplete
   */
  customDropdownButton?: (config: {
    actions: MenuActions;
    isOpen: boolean;
    selectedProjects: Project[];
  }) => React.ReactElement;
  /**
   * The loading indicator to render when global selection is not yet ready.
   */
  customLoadingIndicator?: React.ReactNode;
  detached?: boolean;
  /**
   * Only allow a single project to be selected at once
   */
  disableMultipleProjectSelection?: boolean;
  /**
   * Message to show in the footer
   */
  footerMessage?: React.ReactNode;
  /**
   * Forces a specific project to be selected and does _not_ allow editing of the project selection.
   *
   * @deprecated This was used in the old Global Selection Header
   */
  forceProject?: MinimalProject | null;
  isGlobalSelectionReady?: boolean;
  /**
   * Used when `forceProject` is set. Indicates what is "locked"
   *
   * @deprecated
   */
  lockedMessageSubject?: React.ReactNode;
  /**
   * When we expect forceProject to be set, but the project is still loading, we
   * can use this to hint that the forceProject will be set.
   *
   * @deprecated
   */
  shouldForceProject?: boolean;
  /**
   * Link back to the issues strean
   *
   * @deprecated
   */
  showIssueStreamLink?: boolean;
  /**
   * Show the pinning icon in the projects dropdown
   */
  showPin?: boolean;
  /**
   * Show a link to the project settings in th header
   *
   * @deprecated
   */
  showProjectSettingsLink?: boolean;
};

type State = {
  hasChanges: boolean;
};

class ProjectSelector extends PureComponent<Props, State> {
  static defaultProps = {
    lockedMessageSubject: t('page'),
  };

  state: State = {
    hasChanges: false,
  };

  /**
   * Used to keep selected proects sorted in the same order when opening / closing the project selector
   */
  lastSelected = this.props.value;

  get multi() {
    const {organization, disableMultipleProjectSelection} = this.props;
    return (
      !disableMultipleProjectSelection && organization.features.includes('global-views')
    );
  }

  /**
   * Reset "hasChanges" state and call `onUpdate` callback
   * @param value optional parameter that will be passed to onUpdate callback
   */
  doUpdate = (value?: number[]) => {
    this.setState({hasChanges: false}, () => this.props.onUpdate(value));
  };

  /**
   * Handler for when an explicit update call should be made.
   * e.g. an "Update" button
   *
   * Should perform an "update" callback
   */
  handleUpdate = (actions: {close: () => void}) => {
    actions.close();
    this.doUpdate();
  };

  /**
   * Handler for when a dropdown item was selected directly (and not via multi select)
   *
   * Should perform an "update" callback
   */
  handleQuickSelect = (selected: Pick<Project, 'id'>) => {
    trackAdvancedAnalyticsEvent('projectselector.direct_selection', {
      path: getRouteStringFromRoutes(this.props.router.routes),
      organization: this.props.organization,
    });
    const value = selected.id === null ? [] : [parseInt(selected.id, 10)];
    this.props.onChange(value);
    this.doUpdate(value);
  };

  /**
   * Handler for when dropdown menu closes
   *
   * Should perform an "update" callback
   */
  handleClose = () => {
    // Only update if there are changes
    if (!this.state.hasChanges) {
      return;
    }

    const {value} = this.props;

    trackAdvancedAnalyticsEvent('projectselector.update', {
      count: value.length,
      path: getRouteStringFromRoutes(this.props.router.routes),
      organization: this.props.organization,
      multi: this.multi,
    });

    this.doUpdate();
    this.lastSelected = value;
  };

  /**
   * Handler for clearing the current value
   *
   * Should perform an "update" callback
   */
  handleClear = () => {
    trackAdvancedAnalyticsEvent('projectselector.clear', {
      path: getRouteStringFromRoutes(this.props.router.routes),
      organization: this.props.organization,
    });

    this.props.onChange([]);

    // Update on clear
    this.doUpdate();
  };

  /**
   * Handler for selecting multiple items, should NOT call update
   */
  handleMultiSelect = (selected: Project[]) => {
    const {onChange, value} = this.props;

    trackAdvancedAnalyticsEvent('projectselector.toggle', {
      action: selected.length > value.length ? 'added' : 'removed',
      path: getRouteStringFromRoutes(this.props.router.routes),
      organization: this.props.organization,
    });

    const selectedList = selected.map(({id}) => parseInt(id, 10)).filter(i => i);
    onChange(selectedList);
    this.setState({hasChanges: true});
  };

  renderProjectName() {
    const {forceProject, location, organization, showIssueStreamLink} = this.props;

    if (showIssueStreamLink && forceProject && this.multi) {
      return (
        <Tooltip title={t('Issues Stream')} position="bottom">
          <StyledLink
            to={{
              pathname: `/organizations/${organization.slug}/issues/`,
              query: {...location.query, project: forceProject.id},
            }}
          >
            {forceProject.slug}
          </StyledLink>
        </Tooltip>
      );
    }

    if (forceProject) {
      return forceProject.slug;
    }

    return '';
  }

  getLockedMessage() {
    const {forceProject, lockedMessageSubject} = this.props;

    if (forceProject) {
      return tct('This [subject] is unique to the [projectSlug] project', {
        subject: lockedMessageSubject,
        projectSlug: forceProject.slug,
      });
    }

    return tct('This [subject] is unique to a project', {subject: lockedMessageSubject});
  }

  render() {
    const {
      onChange: _onChange,
      value,
      memberProjects,
      isGlobalSelectionReady,
      disableMultipleProjectSelection,
      nonMemberProjects = [],
      organization,
      shouldForceProject,
      forceProject,
      showProjectSettingsLink,
      footerMessage,
      customDropdownButton,
      customLoadingIndicator,
      showPin,
      ...extraProps
    } = this.props;
    const selectedProjectIds = new Set(value);
    const multi = this.multi;

    const allProjects = [...memberProjects, ...nonMemberProjects];
    const selected = allProjects.filter(project =>
      selectedProjectIds.has(parseInt(project.id, 10))
    );

    // `forceProject` can be undefined if it is loading the project
    // We are intentionally using an empty string as its "loading" state
    if (shouldForceProject) {
      return (
        <StyledHeaderItem
          data-test-id="global-header-project-selector"
          icon={
            forceProject && (
              <PlatformList
                platforms={forceProject.platform ? [forceProject.platform] : []}
                max={1}
              />
            )
          }
          locked
          lockedMessage={this.getLockedMessage()}
          settingsLink={
            (forceProject &&
              showProjectSettingsLink &&
              `/settings/${organization.slug}/projects/${forceProject.slug}/`) ||
            undefined
          }
        >
          {this.renderProjectName()}
        </StyledHeaderItem>
      );
    }

    if (!isGlobalSelectionReady) {
      return (
        customLoadingIndicator ?? (
          <StyledHeaderItem
            data-test-id="global-header-project-selector-loading"
            icon={<IconProject />}
            loading
          >
            {t('Loading\u2026')}
          </StyledHeaderItem>
        )
      );
    }

    const listSort = (project: Project) => [
      !this.lastSelected.includes(parseInt(project.id, 10)),
      !project.isBookmarked,
      project.slug,
    ];

    const projects = sortBy(memberProjects, listSort);
    const otherProjects = sortBy(nonMemberProjects, listSort);

    const handleMultiSelect = (project: Project) => {
      const selectedProjectsMap = new Map(selected.map(p => [p.slug, p]));

      if (selectedProjectsMap.has(project.slug)) {
        // unselected a project
        selectedProjectsMap.delete(project.slug);
        this.handleMultiSelect(Array.from(selectedProjectsMap.values()));
        return;
      }

      selectedProjectsMap.set(project.slug, project);
      this.handleMultiSelect(Array.from(selectedProjectsMap.values()));
    };

    const getProjectItem = (project: Project) => ({
      item: project,
      searchKey: project.slug,
      label: ({inputValue}: {inputValue: typeof project.slug}) => (
        <SelectorItem
          project={project}
          organization={organization}
          multi={multi}
          inputValue={inputValue}
          isChecked={!!selected.find(({slug}) => slug === project.slug)}
          onMultiSelect={handleMultiSelect}
        />
      ),
    });

    const hasProjects = !!projects?.length || !!otherProjects?.length;
    const newProjectUrl = `/organizations/${organization.slug}/projects/new/`;
    const hasProjectWrite = organization.access.includes('project:write');

    const items = !hasProjects
      ? []
      : [
          {
            hideGroupLabel: true,
            items: projects.map(getProjectItem),
          },
          {
            hideGroupLabel: otherProjects.length === 0,
            itemSize: 'small',
            id: 'no-membership-header', // needed for tests for non-virtualized lists
            label: <Label>{t("Projects I don't belong to")}</Label>,
            items: otherProjects.map(getProjectItem),
          },
        ];

    return (
      <ClassNames>
        {({css}) => (
          <StyledDropdownAutocomplete
            {...extraProps}
            blendCorner={false}
            searchPlaceholder={t('Filter projects')}
            onSelect={i => this.handleQuickSelect(i.item)}
            onClose={this.handleClose}
            maxHeight={500}
            minWidth={350}
            inputProps={{style: {padding: 8, paddingLeft: 10}}}
            rootClassName={css`
              display: flex;
            `}
            emptyMessage={t('You have no projects')}
            noResultsMessage={t('No projects found')}
            virtualizedHeight={theme.headerSelectorRowHeight}
            virtualizedLabelHeight={theme.headerSelectorLabelHeight}
            inputActions={
              <InputActions>
                <AddButton
                  aria-label={t('Add Project')}
                  disabled={!hasProjectWrite}
                  to={newProjectUrl}
                  size="xsmall"
                  icon={<IconAdd size="xs" isCircled />}
                  title={
                    !hasProjectWrite
                      ? t("You don't have permission to add a project")
                      : undefined
                  }
                >
                  {showPin ? '' : t('Project')}
                </AddButton>
                {showPin && (
                  <GuideAnchor target="new_page_filter_pin" position="bottom">
                    <PageFilterPinButton size="xsmall" filter="projects" />
                  </GuideAnchor>
                )}
              </InputActions>
            }
            menuFooter={({actions}) => (
              <ProjectSelectorFooter
                selected={selectedProjectIds}
                disableMultipleProjectSelection={disableMultipleProjectSelection}
                organization={organization}
                hasChanges={this.state.hasChanges}
                onApply={() => this.handleUpdate(actions)}
                onShowAllProjects={() => {
                  this.handleQuickSelect({id: ALL_ACCESS_PROJECTS.toString()});
                  actions.close();
                  trackAdvancedAnalyticsEvent('projectselector.multi_button_clicked', {
                    button_type: 'all',
                    path: getRouteStringFromRoutes(this.props.router.routes),
                    organization,
                  });
                }}
                onShowMyProjects={() => {
                  this.handleClear();
                  actions.close();
                  trackAdvancedAnalyticsEvent('projectselector.multi_button_clicked', {
                    button_type: 'my',
                    path: getRouteStringFromRoutes(this.props.router.routes),
                    organization,
                  });
                }}
                message={footerMessage}
              />
            )}
            items={items}
            allowActorToggle
            closeOnSelect
          >
            {({actions, isOpen}) => {
              if (customDropdownButton) {
                return customDropdownButton({
                  actions,
                  selectedProjects: selected,
                  isOpen,
                });
              }
              const hasSelected = !!selected.length;
              const title = hasSelected
                ? selected.map(({slug}) => slug).join(', ')
                : selectedProjectIds.has(ALL_ACCESS_PROJECTS)
                ? t('All Projects')
                : t('My Projects');
              const icon = hasSelected ? (
                <PlatformList
                  platforms={selected.map(p => p.platform ?? 'other').reverse()}
                  max={5}
                />
              ) : (
                <IconProject />
              );

              return (
                <StyledHeaderItem
                  data-test-id="global-header-project-selector"
                  icon={icon}
                  hasSelected={hasSelected}
                  hasChanges={this.state.hasChanges}
                  isOpen={isOpen}
                  onClear={this.handleClear}
                  allowClear={multi}
                  settingsLink={
                    selected.length === 1
                      ? `/settings/${organization.slug}/projects/${selected[0]?.slug}/`
                      : ''
                  }
                >
                  {title}
                </StyledHeaderItem>
              );
            }}
          </StyledDropdownAutocomplete>
        )}
      </ClassNames>
    );
  }
}

export default withRouter(ProjectSelector);

const StyledDropdownAutocomplete = styled(DropdownAutoComplete)`
  background-color: ${p => p.theme.background};
  color: ${p => p.theme.textColor};

  ${p =>
    !p.detached &&
    `
    width: 100%;
    margin: 1px 0 0 -1px;
    border-radius: ${p.theme.borderRadiusBottom};
  `}
`;

const StyledHeaderItem = styled(HeaderItem)`
  height: 100%;
  width: 100%;
  ${p => p.locked && 'cursor: default'};
`;

const StyledLink = styled(Link)`
  color: ${p => p.theme.subText};

  &:hover {
    color: ${p => p.theme.subText};
  }
`;

const Label = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.gray300};
`;

const AddButton = styled(Button)`
  display: block;
  color: ${p => p.theme.gray300};
  :hover {
    color: ${p => p.theme.subText};
  }
`;

const InputActions = styled('div')`
  display: grid;
  margin: 0 ${space(1)};
  gap: ${space(1)};
  grid-auto-flow: column;
  grid-auto-columns: auto;
`;
