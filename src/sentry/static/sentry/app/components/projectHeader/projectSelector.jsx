import {withRouter} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';
import styled, {css} from 'react-emotion';

import {sortArray} from 'app/utils';
import {t} from 'app/locale';
import DropdownAutoComplete from 'app/components/dropdownAutoComplete';
import IdBadge from 'app/components/idBadge';
import InlineSvg from 'app/components/inlineSvg';
import Link from 'app/components/link';
import MenuItem from 'app/components/menuItem';
import space from 'app/styles/space';

const ProjectSelector = withRouter(
  class ProjectSelector extends React.Component {
    static propTypes = {
      // Accepts a project id (slug) and not a project *object* because ProjectSelector
      // is created from Django templates, and only organization is serialized
      projectId: PropTypes.string,
      organization: PropTypes.object.isRequired,
      router: PropTypes.object,
    };

    static contextTypes = {
      location: PropTypes.object,
    };

    static defaultProps = {
      projectId: null,
    };

    constructor(props) {
      super(props);
      this.state = {
        activeProject: null,
        ...this.getProjectState({filter: ''}),
      };
    }

    urlPrefix() {
      let org = this.props.organization;
      return `/organizations/${org.slug}`;
    }

    /**
   * Returns an object with the target project url. If
   * the router is present, passed as the 'to' property.
   * If not, passed as an absolute URL via the 'href' property.
   */
    getProjectUrlProps(project) {
      let org = this.props.organization;
      let path = `/${org.slug}/${project.slug}/`;

      if (this.context.location) {
        return {to: path};
      } else {
        return {href: path};
      }
    }

    getProjectState(state) {
      state = state || this.state;
      let org = this.props.organization;
      let filter = state.filter.toLowerCase();
      let projectList = [];

      let activeProject;

      org.projects.forEach(project => {
        if (!project.isMember) {
          return;
        }
        if (project.slug === this.props.projectId) {
          activeProject = project;
        }

        let fullName;
        fullName = [project.name, project.slug];
        fullName = fullName.join(' ').toLowerCase();

        if (filter && fullName.indexOf(filter) === -1) {
          return;
        }
        projectList.push(project);
      });
      return {
        projectList,
        activeProject,
      };
    }

    getProjectLabel(project) {
      return project.slug;
    }

    handleSelect = ({value: project}) => {
      let {router} = this.props;
      let {to, href} = this.getProjectUrlProps(project);
      if (to) {
        router.push(to);
      } else {
        window.location.assign(href);
      }
      this.setState({activeProject: project});
    };

    render() {
      let {organization: org} = this.props;
      let access = new Set(org.access);

      let projectList = sortArray(this.state.projectList, project => {
        return [!project.isBookmarked, project.name];
      });

      // TODO(billy): Only show platform icons for internal users
      const internalOnly =
        org && org.features && org.features.includes('internal-catchall');

      const hasFilter = !!this.state.filter;
      const hasProjects = projectList && !!projectList.length;
      const hasProjectWrite = access.has('project:write');
      const showDivider = !hasFilter && hasProjectWrite;
      // const dropdownClassNames = classNames('project-dropdown', {
      // 'is-empty': !hasProjects,
      // });

      return (
        <div className="project-select">
          <h3>
            <DropdownAutoComplete
              alignMenu="left"
              blendCorner={false}
              filterPlaceholder={t('Filter projects')}
              onSelect={this.handleSelect}
              style={{zIndex: 1001, marginTop: 2, maxHeight: 500}}
              inputProps={{style: {padding: 8, paddingLeft: 14}}}
              menuHeader={
                !hasProjects ? (
                  <React.Fragment>
                    <MenuItem className="empty-projects-item" noAnchor>
                      <div className="empty-message">
                        {hasFilter && t('No projects found')}
                        {!hasFilter && t('You have no projects.')}
                      </div>
                    </MenuItem>
                    {showDivider ? <MenuItem divider /> : null}
                    {!hasFilter && hasProjectWrite ? (
                      <MenuItem className="empty-projects-item" noAnchor>
                        <a
                          className="btn btn-primary btn-block"
                          href={`${this.urlPrefix()}/projects/new/`}
                        >
                          {t('Create project')}
                        </a>
                      </MenuItem>
                    ) : null}
                  </React.Fragment>
                ) : null
              }
              items={projectList.map(project => ({
                value: project,
                label: (
                  <ProjectRow>
                    <IdBadge
                      project={project}
                      avatarSize={16}
                      displayName={project.slug}
                      avatarProps={{consistentWidth: true}}
                    />
                    {project.isBookmarked && <BookmarkIcon />}
                  </ProjectRow>
                ),
              }))}
            >
              {({getActorProps, selectedItem}) => (
                <DropdownLabel>
                  {this.state.activeProject ? (
                    <IdBadge
                      project={this.state.activeProject}
                      avatarSize={16}
                      hideAvatar={!internalOnly}
                      displayName={
                        <Link {...this.getProjectUrlProps(this.state.activeProject)}>
                          {this.getProjectLabel(this.state.activeProject)}
                        </Link>
                      }
                    />
                  ) : (
                    <span
                      {...getActorProps({
                        role: 'button',
                        style: {cursor: 'pointer'},
                      })}
                    >
                      {t('Select a project')}
                    </span>
                  )}
                  <DropdownIcon />
                </DropdownLabel>
              )}
            </DropdownAutoComplete>
          </h3>
        </div>
      );
    }
  }
);

const flexCss = css`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const ProjectRow = styled.div`
  ${flexCss};
  font-size: 14px;
  font-weight: 400;
`;

const BookmarkIcon = styled(props => (
  <div {...props}>
    <span className="icon-star-solid bookmark" />
  </div>
))`
  font-size: 12px;
`;

const DropdownLabel = styled.div`
  ${flexCss};
  margin-right: ${space(1)};
`;

const DropdownIcon = styled(props => <InlineSvg {...props} src="icon-chevron-down" />)`
  margin-left: ${space(0.5)};
  font-size: 10px;
`;
export default ProjectSelector;
