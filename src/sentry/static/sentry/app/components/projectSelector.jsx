import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {sortArray} from 'app/utils';
import {t} from 'app/locale';
import Button from 'app/components/button';
import DropdownAutoComplete from 'app/components/dropdownAutoComplete';
import Highlight from 'app/components/highlight';
import IdBadge from 'app/components/idBadge';
import space from 'app/styles/space';

class ProjectSelector extends React.Component {
  static propTypes = {
    // Accepts a project id (slug) and not a project *object* because ProjectSelector
    // is created from Django templates, and only organization is serialized
    projectId: PropTypes.string,
    organization: PropTypes.object.isRequired,

    // Callback when a project is selected
    onSelect: PropTypes.func,
  };

  static defaultProps = {
    projectId: null,
    onSelect: () => {},
  };

  constructor(props) {
    super(props);

    this.state = {
      activeProject: this.getActiveProject(),
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
    const {organization} = this.props;
    return organization.projects.filter(project => project.isMember);
  }

  getProjectLabel(project) {
    return project.slug;
  }

  handleSelect = ({value: project}) => {
    const {onSelect} = this.props;
    this.setState({activeProject: project});
    onSelect(project);
  };

  render() {
    let {children, organization: org} = this.props;
    let access = new Set(org.access);

    let projectList = sortArray(this.getProjects(), project => {
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
              <BadgeWrapper>
                <IdBadgeMenuItem
                  project={project}
                  avatarSize={16}
                  displayName={<Highlight text={inputValue}>{project.slug}</Highlight>}
                  avatarProps={{consistentWidth: true}}
                />
                {project.isBookmarked && <BookmarkIcon />}
              </BadgeWrapper>
            </ProjectRow>
          ),
        }))}
      >
        {renderProps =>
          children({...renderProps, activeProject: this.state.activeProject})}
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

const BookmarkIcon = styled(props => (
  <div {...props}>
    <span className="icon-star-solid bookmark" />
  </div>
))`
  display: flex;
  font-size: 12px;
`;

const CreateProjectButton = styled(Button)`
  display: block;
  text-align: center;
  margin: ${space(0.5)} 0;
`;

const BadgeWrapper = styled('div')`
  display: flex;
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
`;

const IdBadgeMenuItem = styled(IdBadge)`
  flex: 1;
  overflow: hidden;
`;

export default ProjectSelector;
