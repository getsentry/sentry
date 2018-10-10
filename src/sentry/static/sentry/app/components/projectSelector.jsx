import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {sortArray} from 'app/utils';
import {t} from 'app/locale';
import Button from 'app/components/button';
import Checkbox from 'app/components/checkbox';
import DropdownAutoComplete from 'app/components/dropdownAutoComplete';
import Highlight from 'app/components/highlight';
import IdBadge from 'app/components/idBadge';
import SentryTypes from 'app/sentryTypes';
import space from 'app/styles/space';

class ProjectSelector extends React.Component {
  static propTypes = {
    // Accepts a project id (slug) and not a project *object* because ProjectSelector
    // is created from Django templates, and only organization is serialized
    projectId: PropTypes.string,
    organization: PropTypes.object.isRequired,
    projects: PropTypes.arrayOf(
      PropTypes.oneOfType([PropTypes.string, SentryTypes.Project])
    ),

    // Allow selecting multiple projects?
    multi: PropTypes.bool,

    initialSelectedProjects: PropTypes.arrayOf(SentryTypes.Project),
    selectedProjects: PropTypes.arrayOf(SentryTypes.Project),

    // Callback when a project is selected
    onSelect: PropTypes.func,

    // Callback when projects are selected via the multiple project selector
    // Calls back with (project, checked, event)
    onMultiSelect: PropTypes.func,
  };

  static defaultProps = {
    projectId: null,
    multi: false,
    onSelect: () => {},
    initialSelectedProjects: [],
  };

  constructor(props) {
    super(props);

    this.state = {
      activeProject: this.getActiveProject(),
      selectedProjects: new Map(props.initialSelectedProjects.map(({slug}) => slug)),
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

  isControlled = () => typeof this.props.selectedProjects !== 'undefined';

  toggleProject(project) {
    let {slug} = project;
    // Don't update state if this is a controlled component
    if (this.isControlled()) return;

    this.setState(state => {
      const selectedProjects = new Map(state.selectedProjects.entries());

      if (selectedProjects.has(slug)) {
        selectedProjects.delete(slug);
      } else {
        selectedProjects.set(slug, project);
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
      let returnValue;

      if (isControlled) {
        if (e.target.checked) {
          // selected a project
          const selectedProjectsMap = new Map([
            ...selectedProjects.map(p => [p.slug, p]),
            [project.slug, project],
          ]);

          returnValue = selectedProjectsMap;
        } else {
          // unselected a project
          const selectedProjectsMap = new Map(selectedProjects.map(p => [p.slug, p]));

          selectedProjectsMap.delete(project.slug);
          returnValue = selectedProjectsMap;
        }
      } else {
        returnValue = this.state.selectedProjects;
      }

      onMultiSelect(Array.from(returnValue.values()), e.target.checked, e);
    }

    this.toggleProject(project);
  };

  render() {
    const {children, organization: org, multi} = this.props;
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
        blendCorner={false}
        filterPlaceholder={t('Filter projects')}
        onSelect={this.handleSelect}
        maxHeight={500}
        zIndex={1001}
        style={{marginTop: 6}}
        inputProps={{style: {padding: 8, paddingLeft: 14}}}
        emptyMessage={t('You have no projects')}
        noResultsMessage={t('No projects found')}
        virtualizedHeight={33}
        emptyHidesInput
        menuFooter={
          !hasProjects && hasProjectWrite ? (
            <CreateProjectButton
              priority="primary"
              size="small"
              to={`${this.urlPrefix()}/projects/new/`}
            >
              {t('Create project')}
            </CreateProjectButton>
          ) : null
        }
        items={projectList.map(project => ({
          value: project,
          searchKey: project.slug,
          label: ({inputValue}) => (
            <ProjectRow>
              <BadgeWrapper multi={multi}>
                <IdBadgeMenuItem
                  project={project}
                  avatarSize={16}
                  displayName={<Highlight text={inputValue}>{project.slug}</Highlight>}
                  avatarProps={{consistentWidth: true}}
                />
                {project.isBookmarked && <BookmarkIcon multi={multi} />}
              </BadgeWrapper>

              {multi && (
                <MultiSelect
                  checked={
                    this.isControlled()
                      ? this.props.selectedProjects.find(
                          ({slug}) => slug === project.slug
                        )
                      : this.state.selectedProjects.has(project.slug)
                  }
                  onClick={e => e.stopPropagation()}
                  onChange={e => this.handleMultiSelect(project, e)}
                />
              )}
            </ProjectRow>
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

const FlexY = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const ProjectRow = styled(FlexY)`
  font-size: 14px;
  font-weight: 400;

  /* thanks bootstrap? */
  input[type='checkbox'] {
    margin: 0;
  }
`;

const BookmarkIcon = styled(({multi, ...props}) => (
  <div {...props}>
    <span className="icon-star-solid bookmark" />
  </div>
))`
  display: flex;
  font-size: 12px;
  ${p => p.multi && `margin-left: ${space(0.5)}`};
`;

const CreateProjectButton = styled(Button)`
  display: block;
  text-align: center;
  margin: ${space(0.5)} 0;
`;

const BadgeWrapper = styled('div')`
  display: flex;
  flex: 1;
  ${p => !p.multi && 'justify-content: space-between'};
  white-space: nowrap;
  overflow: hidden;
`;

const IdBadgeMenuItem = styled(IdBadge)`
  flex: 1;
  overflow: hidden;
`;

const MultiSelect = styled(Checkbox)`
  flex-shrink: 0;
  border: 1px solid ${p => p.theme.borderLight};

  &:hover {
    border-color: ${p => p.theme.borderDark};
  }
`;

export default ProjectSelector;
