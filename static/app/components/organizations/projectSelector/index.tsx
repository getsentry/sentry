import {Fragment, useMemo, useRef, useState} from 'react';
import {withRouter, WithRouterProps} from 'react-router';
import {ClassNames} from '@emotion/react';
import styled from '@emotion/styled';
import sortBy from 'lodash/sortBy';

import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import DropdownAutoComplete from 'sentry/components/dropdownAutoComplete';
import {MenuActions} from 'sentry/components/dropdownMenu';
import Link from 'sentry/components/links/link';
import HeaderItem from 'sentry/components/organizations/headerItem';
import PageFilterPinButton from 'sentry/components/organizations/pageFilters/pageFilterPinButton';
import PlatformList from 'sentry/components/platformList';
import Tooltip from 'sentry/components/tooltip';
import {ALL_ACCESS_PROJECTS} from 'sentry/constants/pageFilters';
import {IconProject} from 'sentry/icons';
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
   * Triggered when the selection changes are applied
   */
  onApplyChange: (newProjects: number[]) => void;
  /**
   * Triggers any time a selection is changed, but the menu has not yet been closed or "applied"
   */
  onChange: (selected: number[]) => void;
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

function ProjectSelector({
  customDropdownButton,
  customLoadingIndicator,
  disableMultipleProjectSelection,
  footerMessage,
  forceProject,
  isGlobalSelectionReady,
  location,
  lockedMessageSubject = t('page'),
  memberProjects,
  nonMemberProjects = [],
  onApplyChange,
  onChange,
  organization,
  router,
  shouldForceProject,
  showIssueStreamLink,
  showPin,
  showProjectSettingsLink,
  value,
  ...extraProps
}: Props) {
  // Used to determine if we should show the 'apply' changes button
  const [hasChanges, setHasChanges] = useState(false);

  // Used to keep selected proects sorted in the same order when opening /
  // closing the project selector
  const lastSelected = useRef(value);

  const isMulti =
    !disableMultipleProjectSelection && organization.features.includes('global-views');

  /**
   * Reset "hasChanges" state and call `onApplyChange` callback
   *
   * @param value optional parameter that will be passed to onApplyChange callback
   */
  const doApplyChange = (newValue: number[]) => {
    setHasChanges(false);
    onApplyChange(newValue);
  };

  /**
   * Handler for when an explicit update call should be made.
   * e.g. an "Update" button
   *
   * Should perform an "update" callback
   */
  const handleUpdate = (actions: {close: () => void}) => {
    actions.close();
    doApplyChange(value);
  };

  /**
   * Handler for when a dropdown item was selected directly (and not via multi select)
   *
   * Should perform an "update" callback
   */
  const handleQuickSelect = (selected: Pick<Project, 'id'>) => {
    trackAdvancedAnalyticsEvent('projectselector.direct_selection', {
      path: getRouteStringFromRoutes(router.routes),
      organization,
    });

    const newValue = selected.id === null ? [] : [parseInt(selected.id, 10)];
    onChange(newValue);
    doApplyChange(newValue);
  };

  /**
   * Handler for when dropdown menu closes
   *
   * Should perform an "update" callback
   */
  const handleClose = () => {
    // Only update if there are changes
    if (!hasChanges) {
      return;
    }

    trackAdvancedAnalyticsEvent('projectselector.update', {
      count: value.length,
      path: getRouteStringFromRoutes(router.routes),
      organization,
      multi: isMulti,
    });

    doApplyChange(value);
    lastSelected.current = value;
  };

  /**
   * Handler for clearing the current value
   *
   * Should perform an "update" callback
   */
  const handleClear = () => {
    trackAdvancedAnalyticsEvent('projectselector.clear', {
      path: getRouteStringFromRoutes(router.routes),
      organization,
    });

    onChange([]);
    doApplyChange([]);
  };

  const allProjects = [...memberProjects, ...nonMemberProjects];
  const selectedProjectIds = useMemo(() => new Set(value), [value]);

  const selected = allProjects.filter(project =>
    selectedProjectIds.has(parseInt(project.id, 10))
  );

  // `forceProject` can be undefined if it is loading the project
  // We are intentionally using an empty string as its "loading" state
  if (shouldForceProject) {
    const projectName =
      forceProject && showIssueStreamLink && isMulti ? (
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
      ) : forceProject ? (
        forceProject.slug
      ) : (
        ''
      );

    const lockedMessage = forceProject
      ? tct('This [subject] is unique to the [projectSlug] project', {
          subject: lockedMessageSubject,
          projectSlug: forceProject.slug,
        })
      : tct('This [subject] is unique to a project', {subject: lockedMessageSubject});

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
        lockedMessage={lockedMessage}
        settingsLink={
          (forceProject &&
            showProjectSettingsLink &&
            `/settings/${organization.slug}/projects/${forceProject.slug}/`) ||
          undefined
        }
      >
        {projectName}
      </StyledHeaderItem>
    );
  }

  if (!isGlobalSelectionReady) {
    return (
      <Fragment>{customLoadingIndicator}</Fragment> ?? (
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
    !lastSelected.current.includes(parseInt(project.id, 10)),
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
    } else {
      selectedProjectsMap.set(project.slug, project);
    }

    trackAdvancedAnalyticsEvent('projectselector.toggle', {
      action: selected.length > value.length ? 'added' : 'removed',
      path: getRouteStringFromRoutes(router.routes),
      organization,
    });

    const selectedList = [...selectedProjectsMap.values()]
      .map(({id}) => parseInt(id, 10))
      .filter(i => i);

    onChange(selectedList);
    setHasChanges(true);
  };

  const getProjectItem = (project: Project) => ({
    item: project,
    searchKey: project.slug,
    label: ({inputValue}: {inputValue: typeof project.slug}) => (
      <SelectorItem
        project={project}
        organization={organization}
        multi={isMulti}
        inputValue={inputValue}
        isChecked={!!selected.find(({slug}) => slug === project.slug)}
        onMultiSelect={handleMultiSelect}
      />
    ),
  });

  const hasProjects = !!projects?.length || !!otherProjects?.length;

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
          onSelect={i => handleQuickSelect(i.item)}
          onClose={handleClose}
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
              hasChanges={hasChanges}
              onApply={() => handleUpdate(actions)}
              onShowAllProjects={() => {
                handleQuickSelect({id: ALL_ACCESS_PROJECTS.toString()});
                actions.close();
                trackAdvancedAnalyticsEvent('projectselector.multi_button_clicked', {
                  button_type: 'all',
                  path: getRouteStringFromRoutes(router.routes),
                  organization,
                });
              }}
              onShowMyProjects={() => {
                handleClear();
                actions.close();
                trackAdvancedAnalyticsEvent('projectselector.multi_button_clicked', {
                  button_type: 'my',
                  path: getRouteStringFromRoutes(router.routes),
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
                hasChanges={hasChanges}
                isOpen={isOpen}
                onClear={handleClear}
                allowClear={isMulti}
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

const InputActions = styled('div')`
  display: grid;
  margin: 0 ${space(1)};
  gap: ${space(1)};
  grid-auto-flow: column;
  grid-auto-columns: auto;
`;
