import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {sortArray} from 'app/utils';
import {t} from 'app/locale';
import Button from 'app/components/button';
import InlineSvg from 'app/components/inlineSvg';
import DropdownAutoComplete from 'app/components/dropdownAutoComplete';
import GlobalSelectionHeaderRow from 'app/components/globalSelectionHeaderRow';
import Highlight from 'app/components/highlight';
import IdBadge from 'app/components/idBadge';
import SentryTypes from 'app/sentryTypes';
import space from 'app/styles/space';
import theme from 'app/utils/theme';

class ProjectSelector extends React.Component {
  static propTypes = {
    // Accepts a project id (slug) and not a project *object* because ProjectSelector
    // is created from Django templates, and only organization is serialized
    projectId: PropTypes.string,
    organization: PropTypes.object.isRequired,
    projects: PropTypes.arrayOf(
      PropTypes.oneOfType([PropTypes.string, SentryTypes.Project])
    ),

    // Render a footer at the bottom of the list
    // render function that is passed an `actions` object with `close` and `open` properties.
    menuFooter: PropTypes.func,

    // Allow selecting multiple projects?
    multi: PropTypes.bool,

    // Use this if the component should be a controlled component
    selectedProjects: PropTypes.arrayOf(SentryTypes.Project),

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
    onSelect: () => {},
  };

  constructor(props) {
    super(props);

    this.state = {
      activeProject: this.getActiveProject(),
      selectedProjects: new Map(),
    };
  }

  urlPrefix() {
    return `/organizations/${this.props.organization.slug}`;
  }

  getActiveProject() {
    const {projectId} = this.props;

    const projects = this.getProjects();

    return projects.find(({slug}) => slug === projectId);
  }

  getProjects() {
    const {organization, projects} = this.props;
    const projectList =
      projects || organization.projects.filter(project => project.isMember);

    return sortArray(projectList, project => {
      return [!project.isBookmarked, project.name];
    });
  }

  isControlled = () => typeof this.props.selectedProjects !== 'undefined';

  toggleProject(project, e) {
    const {onMultiSelect} = this.props;
    const {slug} = project;
    // Don't update state if this is a controlled component
    if (this.isControlled()) {
      return;
    }

    this.setState(state => {
      const selectedProjects = new Map(state.selectedProjects.entries());

      if (selectedProjects.has(slug)) {
        selectedProjects.delete(slug);
      } else {
        selectedProjects.set(slug, project);
      }

      if (typeof onMultiSelect === 'function') {
        onMultiSelect(Array.from(selectedProjects.values()), e);
      }

      return {
        selectedProjects,
      };
    });
  }

  handleSelect = ({value: project}) => {
    const {onSelect} = this.props;

    this.setState({activeProject: project});
    onSelect(project);
  };

  handleMultiSelect = (project, e) => {
    const {onMultiSelect, selectedProjects} = this.props;
    const isControlled = this.isControlled();
    const hasCallback = typeof onMultiSelect === 'function';

    if (isControlled && !hasCallback) {
      // eslint-disable-next-line no-console
      console.error(
        'ProjectSelector is a controlled component but `onMultiSelect` callback is not defined'
      );
    }

    if (hasCallback) {
      if (isControlled) {
        const selectedProjectsMap = new Map(selectedProjects.map(p => [p.slug, p]));
        if (selectedProjectsMap.has(project.slug)) {
          // unselected a project

          selectedProjectsMap.delete(project.slug);
        } else {
          selectedProjectsMap.set(project.slug, project);
        }

        onMultiSelect(Array.from(selectedProjectsMap.values()), e);
      }
    }

    this.toggleProject(project, e);
  };

  render() {
    const {
      children,
      organization: org,
      menuFooter,
      multi,
      className,
      rootClassName,
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
        allowActorToggle={true}
        closeOnSelect={true}
        blendCorner={false}
        searchPlaceholder={t('Filter projects')}
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
        virtualizedHeight={theme.headerSelectorRowHeight}
        emptyHidesInput
        inputActions={() => (
          <div>
            <ManageButton to={`/settings/${org.slug}/projects/`} size="xsmall">
              <StyledSettingsIcon src="icon-settings" />
              {t('Manage')}
            </ManageButton>
          </div>
        )}
        menuFooter={renderProps => {
          const renderedFooter =
            typeof menuFooter === 'function' ? menuFooter(renderProps) : menuFooter;
          const showCreateProjectButton = !hasProjects && hasProjectWrite;

          if (!renderedFooter && !showCreateProjectButton) {
            return null;
          }

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
        items={projectList.map(project => ({
          value: project,
          searchKey: project.slug,
          label: ({inputValue}) => (
            <ProjectSelectorItem
              project={project}
              organization={org}
              multi={multi}
              inputValue={inputValue}
              isChecked={
                this.isControlled()
                  ? !!this.props.selectedProjects.find(({slug}) => slug === project.slug)
                  : this.state.selectedProjects.has(project.slug)
              }
              onMultiSelect={this.handleMultiSelect}
            />
          ),
        }))}
      >
        {renderProps =>
          children({
            ...renderProps,
            activeProject,
            selectedProjects: this.isControlled()
              ? this.props.selectedProjects
              : Array.from(this.state.selectedProjects.values()),
          })}
      </DropdownAutoComplete>
    );
  }
}

class ProjectSelectorItem extends React.PureComponent {
  static propTypes = {
    project: SentryTypes.Project,
    multi: PropTypes.bool,
    inputValue: PropTypes.string,
    isChecked: PropTypes.bool,
    onMultiSelect: PropTypes.func,
  };

  handleMultiSelect = e => {
    const {project, onMultiSelect} = this.props;
    onMultiSelect(project, e);
  };

  handleClick = e => {
    e.stopPropagation();
    this.handleMultiSelect(e);
  };

  render() {
    const {project, multi, inputValue, isChecked} = this.props;

    return (
      <GlobalSelectionHeaderRow
        checked={isChecked}
        onCheckClick={this.handleClick}
        multi={multi}
      >
        <BadgeWrapper multi={multi}>
          <IdBadgeMenuItem
            project={project}
            avatarSize={16}
            displayName={<Highlight text={inputValue}>{project.slug}</Highlight>}
            avatarProps={{consistentWidth: true}}
          />
        </BadgeWrapper>
        {project.isBookmarked && <BookmarkIcon src="icon-star-small-filled" />}
      </GlobalSelectionHeaderRow>
    );
  }
}

const BookmarkIcon = styled(InlineSvg)`
  margin-left: ${space(0.5)};
  color: ${p => p.theme.yellowOrange};
  margin-top: -2px; /* trivial alignment bump */
`;

const CreateProjectButton = styled(Button)`
  display: block;
  text-align: center;
  margin: ${space(0.5)} 0;
`;

const BadgeWrapper = styled('div')`
  display: flex;
  ${p => !p.multi && 'flex: 1'};
  white-space: nowrap;
  overflow: hidden;
`;

const IdBadgeMenuItem = styled(IdBadge)`
  flex: 1;
  overflow: hidden;
`;

const StyledSettingsIcon = styled(InlineSvg)`
  margin-right: ${space(0.25)};
`;

const ManageButton = styled(Button)`
  display: block;
  margin: 0 ${space(2)};
  box-shadow: none;
  border: 0;
  background: ${p => p.theme.offWhite2};
  color: ${p => p.theme.gray3};
  transition: 0.2s transform;

  &:hover,
  &:active,
  &:focus {
    box-shadow: none;
    border: 0;
    background: ${p => p.theme.gray1};
    color: #000;
  }
`;

export default ProjectSelector;
