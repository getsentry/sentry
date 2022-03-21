import {Fragment, useRef} from 'react';
import styled from '@emotion/styled';
import sortBy from 'lodash/sortBy';

import Button from 'sentry/components/button';
import DropdownAutoComplete from 'sentry/components/dropdownAutoComplete';
import PageFilterPinButton from 'sentry/components/organizations/pageFilters/pageFilterPinButton';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization, Project} from 'sentry/types';
import theme from 'sentry/utils/theme';

import SelectorItem from './selectorItem';

type DropdownAutoCompleteProps = React.ComponentProps<typeof DropdownAutoComplete>;

type Props = {
  children: (
    args: Parameters<DropdownAutoCompleteProps['children']>[0] & {
      selectedProjects: Project[];
    }
  ) => React.ReactElement;
  /**
   * Used by multiProjectSelector
   */
  multiProjects: Array<Project>;
  nonMemberProjects: Array<Project>;
  /**
   * Callback when a project is selected
   */
  onSelect: (project: Project) => void;
  organization: Organization;
  /**
   * Use this if the component should be a controlled component
   */
  selectedProjects: Array<Project>;
  /**
   * Whether the menu should be detached from the actor
   */
  detached?: boolean;
  /**
   * Allow selecting multiple projects
   */
  multi?: boolean;
  /**
   * Callback when the input filter changes
   */
  onFilterChange?: () => void;
  /**
   * Callback when projects are selected via the multiple project selector
   * Calls back with (projects[], event)
   */
  onMultiSelect?: (projects: Array<Project>, event: React.MouseEvent) => void;
  /**
   * Represents if the current project selector is paginated or fully loaded.
   * Currently only used to ensure that in an empty state the input is not
   * hidden. This is for the case in which a user searches for a project which
   * does not exist. If we hide the input due to no results, the user cannot
   * recover
   */
  paginated?: boolean;
  /**
   * Represents if a search is taking place
   */
  searching?: boolean;
  /**
   * Show the pin button in the dropdown's header actions
   */
  showPin?: boolean;
} & Pick<
  DropdownAutoCompleteProps,
  'menuFooter' | 'onScroll' | 'onClose' | 'rootClassName' | 'className'
>;

const ProjectSelector = ({
  children,
  organization,
  menuFooter,
  className,
  rootClassName,
  detached,
  onClose,
  onFilterChange,
  onScroll,
  searching,
  paginated,
  multiProjects,
  onSelect,
  onMultiSelect,
  multi = false,
  selectedProjects = [],
  showPin,
  ...props
}: Props) => {
  // We'll only update the selected project list every time we open the menu,
  // this helps avoid re-sorting as we select projects.
  const lastSelected = useRef<Project[]>(selectedProjects);

  const handleClose = () => {
    lastSelected.current = selectedProjects;
    onClose?.();
  };

  const getProjects = () => {
    const {nonMemberProjects = []} = props;
    return [
      sortBy(multiProjects, project => [
        !lastSelected.current.find(p => p.slug === project.slug),
        !project.isBookmarked,
        project.slug,
      ]),
      sortBy(nonMemberProjects, project => [project.slug]),
    ];
  };

  const [projects, nonMemberProjects] = getProjects();

  const handleSelect = ({value: project}: {value: Project}) => {
    onSelect(project);
  };

  const handleMultiSelect = (project: Project, event: React.MouseEvent) => {
    if (!onMultiSelect) {
      // eslint-disable-next-line no-console
      console.error(
        'ProjectSelector is a controlled component but `onMultiSelect` callback is not defined'
      );
      return;
    }

    const selectedProjectsMap = new Map(selectedProjects.map(p => [p.slug, p]));

    if (selectedProjectsMap.has(project.slug)) {
      // unselected a project
      selectedProjectsMap.delete(project.slug);
      onMultiSelect(Array.from(selectedProjectsMap.values()), event);
      return;
    }

    selectedProjectsMap.set(project.slug, project);
    onMultiSelect(Array.from(selectedProjectsMap.values()), event);
  };

  const getProjectItem = (project: Project) => ({
    value: project,
    searchKey: project.slug,
    label: ({inputValue}: {inputValue: typeof project.slug}) => (
      <SelectorItem
        project={project}
        organization={organization}
        multi={multi}
        inputValue={inputValue}
        isChecked={!!selectedProjects.find(({slug}) => slug === project.slug)}
        onMultiSelect={handleMultiSelect}
      />
    ),
  });

  const getItems = (hasProjects: boolean) => {
    if (!hasProjects) {
      return [];
    }

    return [
      {
        hideGroupLabel: true,
        items: projects.map(getProjectItem),
      },
      {
        hideGroupLabel: nonMemberProjects.length === 0,
        itemSize: 'small',
        id: 'no-membership-header', // needed for tests for non-virtualized lists
        label: <Label>{t("Projects I don't belong to")}</Label>,
        items: nonMemberProjects.map(getProjectItem),
      },
    ];
  };

  const hasProjects = !!projects?.length || !!nonMemberProjects?.length;
  const newProjectUrl = `/organizations/${organization.slug}/projects/new/`;
  const hasProjectWrite = organization.access.includes('project:write');

  return (
    <DropdownAutoComplete
      blendCorner={false}
      detached={detached}
      searchPlaceholder={t('Filter projects')}
      onSelect={handleSelect}
      onClose={handleClose}
      onChange={onFilterChange}
      busyItemsStillVisible={searching}
      onScroll={onScroll}
      maxHeight={500}
      inputProps={{style: {padding: 8, paddingLeft: 10}}}
      rootClassName={rootClassName}
      className={className}
      emptyMessage={t('You have no projects')}
      noResultsMessage={t('No projects found')}
      virtualizedHeight={theme.headerSelectorRowHeight}
      virtualizedLabelHeight={theme.headerSelectorLabelHeight}
      emptyHidesInput={!paginated}
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
          {showPin && <PageFilterPinButton size="xsmall" filter="projects" />}
        </InputActions>
      }
      menuFooter={renderProps => {
        const renderedFooter =
          typeof menuFooter === 'function' ? menuFooter(renderProps) : menuFooter;

        const showCreateProjectButton = !hasProjects && hasProjectWrite;

        if (!renderedFooter && !showCreateProjectButton) {
          return null;
        }

        return (
          <Fragment>
            {showCreateProjectButton && (
              <CreateProjectButton priority="primary" size="small" to={newProjectUrl}>
                {t('Create project')}
              </CreateProjectButton>
            )}
            {renderedFooter}
          </Fragment>
        );
      }}
      items={getItems(hasProjects)}
      allowActorToggle
      closeOnSelect
    >
      {renderProps => children({...renderProps, selectedProjects})}
    </DropdownAutoComplete>
  );
};

export default ProjectSelector;

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

const CreateProjectButton = styled(Button)`
  display: block;
  text-align: center;
  margin: ${space(0.5)} 0;
`;

const InputActions = styled('div')`
  display: grid;
  margin: 0 ${space(1)};
  gap: ${space(1)};
  grid-auto-flow: column;
  grid-auto-columns: auto;
`;
