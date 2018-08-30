import {withRouter} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {sortArray} from 'app/utils';
import {t} from 'app/locale';
import Button from 'app/components/button';
import DropdownAutoComplete from 'app/components/dropdownAutoComplete';
import Highlight from 'app/components/highlight';
import IdBadge from 'app/components/idBadge';
import InlineSvg from 'app/components/inlineSvg';
import Link from 'app/components/link';
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
        activeProject: this.getActiveProject(),
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

      let projectList = sortArray(this.getProjects(), project => {
        return [!project.isBookmarked, project.name];
      });

      // TODO(billy): Only show platform icons for internal users
      const internalOnly =
        org && org.features && org.features.includes('internal-catchall');

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
          menuFooter={
            !hasProjects && hasProjectWrite ? (
              <CreateProjectButton
                alignLabel="center"
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
                <IdBadge
                  project={project}
                  avatarSize={16}
                  displayName={<Highlight text={inputValue}>{project.slug}</Highlight>}
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
                    <ProjectNameLink
                      {...this.getProjectUrlProps(this.state.activeProject)}
                    >
                      {this.getProjectLabel(this.state.activeProject)}
                    </ProjectNameLink>
                  }
                />
              ) : (
                <SelectProject
                  {...getActorProps({
                    role: 'button',
                  })}
                >
                  {t('Select a project')}
                </SelectProject>
              )}
              <DropdownIcon />
            </DropdownLabel>
          )}
        </DropdownAutoComplete>
      );
    }
  }
);

const FlexY = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const ProjectRow = styled(FlexY)`
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

const DropdownLabel = styled(FlexY)`
  margin-right: ${space(1)};
`;

const DropdownIcon = styled(props => <InlineSvg {...props} src="icon-chevron-down" />)`
  margin-left: ${space(0.5)};
  font-size: 10px;
`;

const SelectProject = styled('span')`
  color: ${p => p.theme.gray4};
  cursor: pointer;
  font-size: 20px;
  font-weight: 600;
  padding-right: ${space(0.5)};
`;

const CreateProjectButton = styled(Button)`
  display: block;
  text-align: center;
  margin: ${space(0.5)} 0;
`;

const ProjectNameLink = styled(Link)`
  color: ${p => p.theme.textColor};
  font-size: 20px;
  font-weight: 600;
`;

export default ProjectSelector;
