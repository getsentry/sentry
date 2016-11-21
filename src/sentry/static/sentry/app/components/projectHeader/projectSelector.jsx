import React from 'react';
import ReactDOM from 'react-dom';
import {browserHistory} from 'react-router';
import jQuery from 'jquery';

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
    projectId: React.PropTypes.string,
    organization: React.PropTypes.object.isRequired
  },

  contextTypes: {
    location: React.PropTypes.object
  },

  mixins: [ApiMixin],

  getDefaultProps() {
    return {
      projectId: null
    };
  },

  getInitialState() {
    return {
      filter: '',
      currentIndex: -1,
      ...this.getProjectState({filter: ''})
    };
  },

  componentDidUpdate(prevProps, prevState) {
    // XXX(dcramer): fix odd dedraw issue as of Chrome 45.0.2454.15 dev (64-bit)
    let node = jQuery(ReactDOM.findDOMNode(this.refs.container));
    node.hide().show(0);
  },

  componentWillUnmount() {
    if (this.filterBlurTimeout) {
      clearTimeout(this.filterBlurTimeout);
    }
  },

  onFilterChange(evt) {
    this.setState({
      filter: evt.target.value,
      currentIndex: -1,
      ...this.getProjectState({filter: evt.target.value})
    });
  },

  onKeyUp(evt) {
    if (evt.key === 'Escape' || evt.keyCode === 27) {
      // blur handler should additionally hide dropdown
      this.close();
    }
  },

  onFilterBlur() {
    // HACK: setTimeout because blur might be caused by clicking
    // project link; in which case, will close dropdown before
    // link click is processed. Why 200ms? Decently short time
    // period that seemed to work in all browsers.
    this.filterBlurTimeout = setTimeout(() => {
      this.filterBlurTimeout = null;
      this.close();
    }, 200);
  },

  close() {
    this.setState({
      filter: '',
      currentIndex: -1,
      ...this.getProjectState({filter: ''})
    });
    // dropdownLink might not exist because we try to close within
    // onFilterBlur above after a timeout. My hunch is that sometimes
    // this DOM element is removed within the 200ms, so we error out.
    this.refs.dropdownLink && this.refs.dropdownLink.close();
  },

  getProjectNode(team, project, highlightText, hasSingleTeam, isSelected) {
    let projectId = project.slug;
    let label = this.getProjectLabel(team, project, hasSingleTeam,
                                     highlightText);

    let menuItemProps = {
      key: projectId, // TODO: what if two projects w/ same name under diff orgs?
      linkClassName: projectId == this.props.projectId ? 'active' : '',
      className: isSelected ? 'project-selected' : '',

      // When router is available, use `to` property. Otherwise, use href
      // property. For example - when project selector is loaded on
      // Django-powered Settings pages.

      ...this.getProjectUrlProps(project)
    };

    return (
      <MenuItem {...menuItemProps}>
        {project.isBookmarked && <span className="icon-star-solid bookmark "></span>}
        {label}
      </MenuItem>
    );
  },

  getProjectLabel(team, project, hasSingleTeam, highlightText) {
    let label, text;
    if (!hasSingleTeam && project.name.indexOf(team.name) === -1) {
      label = (
        <span>{team.name} / <ProjectLabel
            project={project} organization={this.props.organization}/></span>
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
        <strong className="highlight">
          {text.substr(idx, highlightText.length)}
        </strong>
        {text.substr(idx + highlightText.length)}
      </span>
    );
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
        <Link to={`/${orgId}/${projectId}/`}>
          {label}
        </Link>
      </span>
    );
  },

  onOpen(evt) {
    ReactDOM.findDOMNode(this.refs.filter).focus();
  },

  onClose() {
    this.setState({
      filter: '',
      currentIndex: -1,
      ...this.getProjectState({filter: ''})
    });
  },

  onKeyDown(evt) {
    let projects = this.state.projectList;
    if (evt.key === 'Down' || evt.keyCode === 40) {
      if (this.state.currentIndex + 1 < projects.length) {
        this.setState({
          currentIndex: this.state.currentIndex + 1
        });
      }
    } else if (evt.key === 'Up' || evt.keyCode === 38) {
      if (this.state.currentIndex > 0) {
        this.setState({
          currentIndex: this.state.currentIndex - 1
        });
      }
    } else if (evt.key === 'Enter' || evt.keyCode === 13) {
      if (this.state.currentIndex > -1) {
        let url = this.getProjectUrlProps(projects[this.state.currentIndex][1]);
        if (url.to) {
          browserHistory.pushState(null, url.to);
        } else if (url.href) {
          window.location = url.href;
        }
      }
    }
  },

  getProjectState(state) {
    state = state || this.state;
    let org = this.props.organization;
    let filter = state.filter.toLowerCase();
    let projectList = [];
    let activeTeam;
    let activeProject;
    org.teams.forEach((team) => {
      if (!team.isMember) {
        return;
      }
      team.projects.forEach((project) => {
        if (project.slug == this.props.projectId) {
          activeProject = project;
          activeTeam = team;
        }
        let fullName = [team.name, project.name, team.slug, project.slug].join(' ').toLowerCase();
        if (filter && fullName.indexOf(filter) === -1) {
          return;
        }
        projectList.push([team, project]);
      });
    });
    return {
      projectList: projectList,
      activeTeam: activeTeam,
      activeProject: activeProject
    };
  },

  render() {
    let org = this.props.organization;
    let hasSingleTeam = org.teams.length === 1;

    let projectList = sortArray(this.state.projectList, ([team, project]) => {
      return [!project.isBookmarked, team.name, project.name];
    });

    let children = projectList.map(([team, project], index) => {
      return this.getProjectNode(team, project, this.state.filter, hasSingleTeam, this.state.currentIndex === index);
    });
    return (
      <div className="project-select" ref="container">
        <h3>
          <Link to={`/${org.slug}/`} className="home-crumb">
            <span className="icon-home" />
          </Link>
          {this.state.activeProject ?
            this.getLinkNode(this.state.activeTeam, this.state.activeProject)
          :
            t('Select a project')
          }
          <DropdownLink ref="dropdownLink" title="" topLevelClasses="project-dropdown"
              onOpen={this.onOpen} onClose={this.onClose}>
            <li className="project-filter" key="_filter">
              <input
                value={this.state.filter}
                type="text"
                placeholder={t('Filter projects')}
                onChange={this.onFilterChange}
                onKeyUp={this.onKeyUp}
                onKeyDown={this.onKeyDown}
                onBlur={this.onFilterBlur}
                ref="filter" />
            </li>
            {children}
          </DropdownLink>
        </h3>
      </div>
    );
  }
});

export default ProjectSelector;
