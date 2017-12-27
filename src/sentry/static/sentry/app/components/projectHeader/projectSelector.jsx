import PropTypes from 'prop-types';
import React from 'react';
import {browserHistory} from 'react-router';
import classNames from 'classnames';

import ApiMixin from '../../mixins/apiMixin';

import ProjectLabel from '../../components/projectLabel';
import DropdownLink from '../dropdownLink';
import MenuItem from '../menuItem';
import Link from '../link';

import {sortArray} from '../../utils';
import {t} from '../../locale';

const ProjectSelector = React.createClass({
  propTypes: {
    // Accepts a project id (slug) and not a project *object* because ProjectSelector
    // is created from Django templates, and only organization is serialized
    projectId: PropTypes.string,
    organization: PropTypes.object.isRequired,
  },

  contextTypes: {
    location: PropTypes.object,
  },

  mixins: [ApiMixin],

  getDefaultProps() {
    return {
      projectId: null,
    };
  },

  getInitialState() {
    return {
      isOpen: false,
      filter: '',
      currentIndex: -1,
      ...this.getProjectState({filter: ''}),
    };
  },

  componentWillUnmount() {
    if (this.filterBlurTimeout) {
      clearTimeout(this.filterBlurTimeout);
    }
  },

  urlPrefix() {
    let org = this.props.organization;
    return `/organizations/${org.slug}`;
  },

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
  },

  getProjectState(state) {
    state = state || this.state;
    let org = this.props.organization;
    let filter = state.filter.toLowerCase();
    let projectList = [];
    let activeTeam;
    let activeProject;
    org.teams.forEach(team => {
      if (!team.isMember) {
        return;
      }
      team.projects.forEach(project => {
        if (project.slug == this.props.projectId) {
          activeProject = project;
          activeTeam = team;
        }
        let fullName = [team.name, project.name, team.slug, project.slug]
          .join(' ')
          .toLowerCase();
        if (filter && fullName.indexOf(filter) === -1) {
          return;
        }
        projectList.push([team, project]);
      });
    });
    return {
      projectList,
      activeTeam,
      activeProject,
    };
  },

  onFilterBlur() {
    // HACK: setTimeout because blur might be caused by clicking
    // project link; in which case, will close dropdown before
    // link click is processed. Why 200ms? Decently short time
    // period that seemed to work in all browsers.
    this.filterBlurTimeout = setTimeout(() => {
      this.filterBlurTimeout = null;
      this.onClose();
    }, 200);
  },

  onFilterChange(evt) {
    this.setState({
      filter: evt.target.value,
      currentIndex: -1,
      ...this.getProjectState({filter: evt.target.value}),
    });
  },

  onFilterClick(e) {
    e.stopPropagation();
  },

  onFilterMount(ref) {
    if (ref) {
      ref.focus();
    }
  },

  onKeyDown(evt) {
    let projects = this.state.projectList;
    if (evt.key === 'Down' || evt.keyCode === 40) {
      if (this.state.currentIndex + 1 < projects.length) {
        this.setState({
          currentIndex: this.state.currentIndex + 1,
        });
      }
    } else if (evt.key === 'Up' || evt.keyCode === 38) {
      if (this.state.currentIndex > 0) {
        this.setState({
          currentIndex: this.state.currentIndex - 1,
        });
      }
    } else if (evt.key === 'Enter' || evt.keyCode === 13) {
      if (this.state.currentIndex > -1) {
        let url = this.getProjectUrlProps(projects[this.state.currentIndex][1]);
        if (url.to) {
          browserHistory.push(url.to);
        } else if (url.href) {
          window.location = url.href;
        }

        this.onClose();
      }
    }
  },

  onKeyUp(evt) {
    if (evt.key === 'Escape' || evt.keyCode === 27) {
      // blur handler should additionally hide dropdown
      this.onClose();
    }
  },

  onOpen() {
    this.setState({
      isOpen: true,
    });
    // Not sure if this is still necessary
    // this.setState(state => ({
    // ...this.getProjectState(state)
    // }));
  },

  onClose() {
    this.setState({
      isOpen: false,
      filter: '',
      currentIndex: -1,
      ...this.getProjectState({filter: ''}),
    });
  },

  getProjectNode(team, project, highlightText, hasSingleTeam, isSelected) {
    let projectId = project.slug;
    let label = this.getProjectLabel(team, project, hasSingleTeam, highlightText);

    let menuItemProps = {
      key: projectId, // TODO: what if two projects w/ same name under diff orgs?
      linkClassName: projectId == this.props.projectId ? 'active' : '',
      className: isSelected ? 'project-selected' : '',

      // When router is available, use `to` property. Otherwise, use href
      // property. For example - when project selector is loaded on
      // Django-powered Settings pages.

      ...this.getProjectUrlProps(project),
    };

    return (
      <MenuItem {...menuItemProps}>
        {project.isBookmarked && <span className="icon-star-solid bookmark " />}
        {label}
      </MenuItem>
    );
  },

  getProjectLabel(team, project, hasSingleTeam, highlightText) {
    let label, text;
    if (!hasSingleTeam && project.name.indexOf(team.name) === -1) {
      label = (
        <span>
          {team.name} /{' '}
          <ProjectLabel project={project} organization={this.props.organization} />
        </span>
      );
      text = team.name + ' / ' + project.name;
    } else {
      label = <span>{project.name}</span>;
      text = project.name;
    }

    if (!highlightText) {
      return label;
    }

    // in case we have something to highlight we just render a replacement
    // selector without the callsigns.
    // TODO(mitsuhiko): make this work with the project label.
    highlightText = highlightText.toLowerCase();
    let idx = text.toLowerCase().indexOf(highlightText);
    if (idx === -1) {
      return text;
    }
    return (
      <span>
        {text.substr(0, idx)}
        <strong className="highlight">{text.substr(idx, highlightText.length)}</strong>
        {text.substr(idx + highlightText.length)}
      </span>
    );
  },

  getLinkNode(team, project) {
    let org = this.props.organization;
    let label = this.getProjectLabel(team, project);

    if (!this.context.location) {
      return <a {...this.getProjectUrlProps(project)}>{label}</a>;
    }

    let orgId = org.slug;
    let projectId = project.slug;

    return (
      <span>
        <Link to={`/${orgId}/${projectId}/`}>{label}</Link>
      </span>
    );
  },

  renderProjectList({organization: org, projects, filter, hasProjectWrite}) {
    const hasFilter = !!filter;
    const hasProjects = projects && projects.length;
    // Will always need to show divider
    const showDivider = !hasFilter && hasProjectWrite;

    if (hasProjects) {
      return projects;
    } else {
      // There can be a filter and have no found results or
      // there can simply be no projects to list
      //
      // Give an actionable item when there are no projects
      return [
        <MenuItem key="empty-message" className="empty-projects-item" noAnchor>
          <div className="empty-message">
            {hasFilter && t('No projects found')}
            {!hasFilter && t('You have no projects.')}
          </div>
        </MenuItem>,
        showDivider ? <MenuItem key="divider" divider /> : null,
        !hasFilter && hasProjectWrite ? (
          <MenuItem key="create-project" className="empty-projects-item" noAnchor>
            <a
              className="btn btn-primary btn-block"
              href={`${this.urlPrefix()}/projects/new/`}
            >
              {t('Create project')}
            </a>
          </MenuItem>
        ) : null,
      ];
    }
  },

  render() {
    let org = this.props.organization;
    let access = new Set(org.access);
    let hasSingleTeam = org.teams.length === 1;

    let projectList = sortArray(this.state.projectList, ([team, project]) => {
      return [!project.isBookmarked, team.name, project.name];
    });

    let children = projectList.map(([team, project], index) => {
      return this.getProjectNode(
        team,
        project,
        this.state.filter,
        hasSingleTeam,
        this.state.currentIndex === index
      );
    });
    const hasFilter = !!this.state.filter;
    const hasProjects = children && !!children.length;
    const dropdownClassNames = classNames('project-dropdown', {
      'is-empty': !hasProjects,
    });

    return (
      <div className="project-select">
        <h3>
          <Link to={`/${org.slug}/`} className="home-crumb">
            <span className="icon-home" />
          </Link>
          {this.state.activeProject
            ? this.getLinkNode(this.state.activeTeam, this.state.activeProject)
            : t('Select a project')}
          <DropdownLink
            title=""
            topLevelClasses={dropdownClassNames}
            isOpen={this.state.isOpen}
            onOpen={this.onOpen}
            onClose={this.onClose}
            alwaysRenderMenu={false}
          >
            {(hasFilter || hasProjects) && (
              <li className="project-filter" key="_filter">
                <input
                  value={this.state.filter}
                  type="text"
                  placeholder={t('Filter projects')}
                  onChange={this.onFilterChange}
                  onKeyUp={this.onKeyUp}
                  onKeyDown={this.onKeyDown}
                  onBlur={this.onFilterBlur}
                  onClick={this.onFilterClick}
                  ref={this.onFilterMount}
                />
              </li>
            )}

            {this.renderProjectList({
              organization: org,
              hasProjectWrite: access.has('project:write'),
              projects: children,
              filter: this.state.filter,
            })}
          </DropdownLink>
        </h3>
      </div>
    );
  },
});

export default ProjectSelector;
