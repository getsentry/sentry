import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {getProjectSelectorType} from 'app/components/projectSelector/utils';
import {sortArray} from 'app/utils';
import {t} from 'app/locale';
import Button from 'app/components/button';
import DropdownAutoComplete from 'app/components/dropdownAutoComplete';
import ProjectSelectorItem from 'app/components/projectSelector/projectSelectorItem';
import SentryTypes from 'app/sentryTypes';
import space from 'app/styles/space';
import theme from 'app/utils/theme';

class ProjectSelector extends React.Component {
  static propTypes = {
    organization: PropTypes.object.isRequired,

    // Accepts a project id (slug) and not a project *object* because ProjectSelector
    // is created from Django templates, and only organization is serialized
    projectId: PropTypes.string,

    // List of projects to show in menu
    projects: PropTypes.arrayOf(
      PropTypes.oneOfType([PropTypes.string, SentryTypes.Project])
    ),

    // List of teams to show in menu
    teams: PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.string, SentryTypes.Team])),

    // Allow teams to be picked
    showTeams: PropTypes.bool,

    // Render a footer at the bottom of the list
    // render function that is passed an `actions` object with `close` and `open` properties.
    menuFooter: PropTypes.func,

    // Allow selecting multiple projects?
    multi: PropTypes.bool,

    // Disable selecting a single project, every action should trigger multi select
    // XXX(billy): This is unused as of 11/1/2018, could be due for a cleanup
    multiOnly: PropTypes.bool,

    // Use this if the component should be a controlled component
    selectedProjects: PropTypes.arrayOf(SentryTypes.Project),
    selectedTeams: PropTypes.arrayOf(SentryTypes.Team),

    // Callback when a project is selected
    onSelect: PropTypes.func,

    // Callback when the menu is closed
    onClose: PropTypes.func,

    // Callback when projects are selected via the multiple project selector
    // Calls back with (projects[], event)
    onMultiSelect: PropTypes.func,
    rootClassName: PropTypes.string,
  };

  static defaultProps = {
    projectId: null,
    multi: false,
    showTeams: false,
    onSelect: () => {},
  };

  constructor(props) {
    super(props);

    this.state = {
      activeProject: this.getActiveProject(),
      selectedProjects: new Map(),
      selectedTeams: new Map(),
    };
  }

  urlPrefix() {
    return `/organizations/${this.props.organization.slug}`;
  }

  getActiveProject() {
    const {projectId} = this.props;
    return this.getProjects().find(({slug}) => slug === projectId);
  }

  getProjects() {
    const {organization, projects} = this.props;
    return projects || organization.projects.filter(project => project.isMember);
  }

  getTeams() {
    const {teams} = this.props;
    return (teams && teams.filter(({isMember}) => isMember)) || [];
  }

  getSelected(model, state) {
    const type = getProjectSelectorType(model);
    const selectedName = type === 'team' ? 'selectedTeams' : 'selectedProjects';
    return this.isControlled()
      ? this.props[selectedName]
      : (state || this.state)[selectedName];
  }

  isControlled = () => typeof this.props.selectedProjects !== 'undefined';

  toggleItem(model, e) {
    const {onMultiSelect} = this.props;
    const type = getProjectSelectorType(model);
    const {slug} = model;

    // Don't update state if this is a controlled component
    if (this.isControlled()) return;

    this.setState(state => {
      const selectedMap = new Map(this.getSelected(model, state).entries());

      if (selectedMap.has(slug)) {
        selectedMap.delete(slug);
      } else {
        selectedMap.set(slug, model);
      }

      if (typeof onMultiSelect === 'function') {
        onMultiSelect(type, Array.from(selectedMap.values()), e);
      }

      return {
        selectedProjects: type === 'team' ? state.selectedProjects : selectedMap,
        selectedTeams: type === 'team' ? selectedMap : state.selectedTeams,
      };
    });
  }

  handleSelect = ({value}) => {
    const {multiOnly, onSelect} = this.props;

    if (!multiOnly) {
      this.setState({activeProject: value});
      onSelect(value);
    } else {
      this.handleMultiSelect(value);
    }
  };

  handleMultiSelect = (model, e) => {
    const {onMultiSelect} = this.props;
    const isControlled = this.isControlled();
    const hasCallback = typeof onMultiSelect === 'function';
    const type = getProjectSelectorType(model);

    if (isControlled && !hasCallback) {
      // eslint-disable-next-line no-console
      console.error(
        'ProjectSelector is a controlled component but `onMultiSelect` callback is not defined'
      );
    }

    if (hasCallback) {
      if (isControlled) {
        const selected = this.getSelected(model);
        const selectedMap = new Map(selected.map(p => [p.slug, p]));
        if (selectedMap.has(model.slug)) {
          // unselected a model
          selectedMap.delete(model.slug);
        } else {
          selectedMap.set(model.slug, model);
        }

        onMultiSelect(type, Array.from(selectedMap.values()), e);
      }
    }

    this.toggleItem(model, e);
  };

  isItemChecked(selected, model) {
    return this.isControlled()
      ? !!selected.find(({slug}) => slug === model.slug)
      : selected.has(model.slug);
  }

  getProjectItems(projectList) {
    const {multi} = this.props;
    const selectedStore = this.isControlled()
      ? this.props.selectedProjects
      : this.state.selectedProjects;

    return projectList.map(project => ({
      value: project,
      searchKey: project.slug,
      label: ({inputValue}) => (
        <ProjectSelectorItem
          project={project}
          multi={multi}
          inputValue={inputValue}
          isChecked={this.isItemChecked(selectedStore, project)}
          onMultiSelect={this.handleMultiSelect}
        />
      ),
    }));
  }

  getTeamItems() {
    const {multi} = this.props;
    const selectedStore = this.isControlled()
      ? this.props.selectedTeams
      : this.state.selectedTeams;

    return this.getTeams()
      .sort((a, b) => a.slug.localeCompare(b.slug))
      .map(team => ({
        value: team,
        searchKey: team.slug,
        label: ({inputValue}) => (
          <ProjectSelectorItem
            team={team}
            multi={multi}
            inputValue={inputValue}
            isChecked={this.isItemChecked(selectedStore, team)}
            onMultiSelect={this.handleMultiSelect}
          />
        ),
      }));
  }

  /**
   * Get list of items to display in dropdown menu
   */
  getItems(projectList) {
    const {showTeams} = this.props;

    if (!showTeams) {
      return this.getProjectItems(projectList);
    }

    return [
      {
        id: 'team-header',
        hideGroupLabel: true,
        items: this.getTeamItems(),
      },
      {
        id: 'project-header',
        hideGroupLabel: true,
        items: this.getProjectItems(projectList),
      },
    ];
  }

  render() {
    const {
      children,
      organization: org,
      menuFooter,
      multiOnly,
      className,
      rootClassName,
      showTeams,
      onClose,
    } = this.props;
    const {activeProject} = this.state;
    const access = new Set(org.access);

    const projects = this.getProjects();
    const projectList = sortArray(projects, project => {
      return [!project.isBookmarked, project.name];
    });

    const hasProjects = projectList && !!projectList.length;
    const hasProjectWrite = access.has('project:write');

    return (
      <DropdownAutoComplete
        alignMenu="left"
        closeOnSelect={!multiOnly}
        blendCorner={false}
        searchPlaceholder={
          showTeams ? t('Search for projects or teams') : t('Search for projects')
        }
        onSelect={this.handleSelect}
        onClose={onClose}
        maxHeight={500}
        zIndex={theme.zIndex.dropdown}
        css={{marginTop: 6}}
        inputProps={{style: {padding: 8, paddingLeft: 14}}}
        rootClassName={rootClassName}
        className={className}
        emptyMessage={t('You have no projects')}
        noResultsMessage={t('No projects found')}
        virtualizedHeight={40}
        emptyHidesInput
        menuFooter={renderProps => {
          const renderedFooter =
            typeof menuFooter === 'function' ? menuFooter(renderProps) : menuFooter;
          const showCreateProjectButton = !hasProjects && hasProjectWrite;

          if (!renderedFooter && !showCreateProjectButton) return null;

          return (
            <React.Fragment>
              {showCreateProjectButton && (
                <CreateProjectButton
                  priority="primary"
                  size="small"
                  to={`${this.urlPrefix()}/projects/new/`}
                >
                  {t('Create project')}
                </CreateProjectButton>
              )}
              {renderedFooter}
            </React.Fragment>
          );
        }}
        items={this.getItems(projectList)}
      >
        {renderProps =>
          children({
            ...renderProps,
            activeProject,
            selectedTeams: this.isControlled()
              ? this.props.selectedTeams
              : Array.from(this.state.selectedTeams.values()),
            selectedProjects: this.isControlled()
              ? this.props.selectedProjects
              : Array.from(this.state.selectedProjects.values()),
          })}
      </DropdownAutoComplete>
    );
  }
}

const CreateProjectButton = styled(Button)`
  display: block;
  text-align: center;
  margin: ${space(0.5)} 0;
`;

export default ProjectSelector;
