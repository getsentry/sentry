import {Fragment, useMemo, useRef, useState} from 'react';
// eslint-disable-next-line no-restricted-imports
import {withRouter, WithRouterProps} from 'react-router';
import {ClassNames} from '@emotion/react';
import styled from '@emotion/styled';
import sortBy from 'lodash/sortBy';

import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import {MenuActions} from 'sentry/components/deprecatedDropdownMenu';
import DropdownAutoComplete from 'sentry/components/dropdownAutoComplete';
import PageFilterPinButton from 'sentry/components/organizations/pageFilters/pageFilterPinButton';
import {ALL_ACCESS_PROJECTS} from 'sentry/constants/pageFilters';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization, Project} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import getRouteStringFromRoutes from 'sentry/utils/getRouteStringFromRoutes';
import theme from 'sentry/utils/theme';

import ProjectSelectorFooter from './footer';
import SelectorItem from './selectorItem';

type Props = WithRouterProps & {
  /**
   * Used to render a custom dropdown button for the DropdownAutoComplete
   */
  customDropdownButton: (config: {
    actions: MenuActions;
    isOpen: boolean;
    selectedProjects: Project[];
  }) => React.ReactElement;
  /**
   * The loading indicator to render when global selection is not yet ready.
   */
  customLoadingIndicator: React.ReactNode;
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
   * Only allow a single project to be selected at once
   */
  disableMultipleProjectSelection?: boolean;
  /**
   * Disable the dropdown
   */
  disabled?: boolean;
  /**
   * Message to show in the footer
   */
  footerMessage?: React.ReactNode;
  isGlobalSelectionReady?: boolean;
};

function ProjectSelector({
  customDropdownButton,
  customLoadingIndicator,
  disableMultipleProjectSelection,
  footerMessage,
  isGlobalSelectionReady,
  memberProjects,
  nonMemberProjects = [],
  onApplyChange,
  onChange,
  organization,
  router,
  value,
  disabled,
}: Props) {
  // Used to determine if we should show the 'apply' changes button
  const [hasChanges, setHasChanges] = useState(false);

  // Used to keep selected projects sorted in the same order when opening /
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

  if (!isGlobalSelectionReady) {
    return <Fragment>{customLoadingIndicator}</Fragment>;
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
        key={project.slug}
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
          detached
          blendCorner={false}
          disabled={disabled}
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
              <GuideAnchor target="new_page_filter_pin" position="bottom">
                <PageFilterPinButton
                  organization={organization}
                  filter="projects"
                  size="xs"
                />
              </GuideAnchor>
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
                trackAdvancedAnalyticsEvent('projectselector.multi_button_clicked', {
                  button_type: 'all',
                  path: getRouteStringFromRoutes(router.routes),
                  organization,
                });

                // The close action here triggers the onClose() handler which we
                // use to apply the current selection. We need that to happen on the
                // next render so that the state will reflect All Projects instead of
                // the outdated selection that exists when this callback is triggered.
                setTimeout(actions.close);
              }}
              onShowMyProjects={() => {
                handleClear();
                trackAdvancedAnalyticsEvent('projectselector.multi_button_clicked', {
                  button_type: 'my',
                  path: getRouteStringFromRoutes(router.routes),
                  organization,
                });

                // The close action here triggers the onClose() handler which we
                // use to apply the current selection. We need that to happen on the
                // next render so that the state will reflect My Projects instead of
                // the outdated selection that exists when this callback is triggered.
                setTimeout(actions.close);
              }}
              message={footerMessage}
            />
          )}
          items={items}
          allowActorToggle
          closeOnSelect
        >
          {({actions, isOpen}) =>
            customDropdownButton({actions, selectedProjects: selected, isOpen})
          }
        </StyledDropdownAutocomplete>
      )}
    </ClassNames>
  );
}

export default withRouter(ProjectSelector);

const StyledDropdownAutocomplete = styled(DropdownAutoComplete)`
  background-color: ${p => p.theme.background};
  color: ${p => p.theme.textColor};
  width: 100%;
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
