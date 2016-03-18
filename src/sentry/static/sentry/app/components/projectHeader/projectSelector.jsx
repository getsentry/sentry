import React from 'react';
import ReactDOM from 'react-dom';
import {Link} from 'react-router';
import jQuery from 'jquery';

import ConfigStore from '../../stores/configStore';
import {update as projectUpdate} from '../../actionCreators/projects';
import ApiMixin from '../../mixins/apiMixin';

import ProjectLabel from '../../components/projectLabel';
import DropdownLink from '../dropdownLink';
import MenuItem from '../menuItem';
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
      filter: ''
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
      filter: evt.target.value
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
    this.setState({filter: ''});
    // dropdownLink might not exist because we try to close within
    // onFilterBlur above after a timeout. My hunch is that sometimes
    // this DOM element is removed within the 200ms, so we error out.
    this.refs.dropdownLink && this.refs.dropdownLink.close();
  },

  handleBookmarkClick(project) {
    projectUpdate(this.api, {
      orgId: this.props.organization.slug,
      projectId: project.slug,
      data: {
        isBookmarked: !project.isBookmarked
      }
    });
  },

  getProjectNode(team, project, highlightText, hasSingleTeam) {
    let projectId = project.slug;
    let label = this.getProjectLabel(team, project, hasSingleTeam,
                                     highlightText);

    let menuItemProps = {
      key: projectId, // TODO: what if two projects w/ same name under diff orgs?
      linkClassName: projectId == this.props.projectId ? 'active' : '',

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
      return {href: ConfigStore.get('urlPrefix') + path};
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

    let className = 'bookmark ' + (project.isBookmarked ? 'icon-star-solid' : 'icon-star-outline');
    return (
      <span>
        <a className={className} onClick={this.handleBookmarkClick.bind(this, project)}></a>
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
      filter: ''
    });
  },

  render() {
    let org = this.props.organization;
    let filter = this.state.filter.toLowerCase();
    let activeTeam;
    let activeProject;
    let hasSingleTeam = org.teams.length === 1;

    let projectList = [];
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

    projectList = sortArray(projectList, ([team, project]) => {
      return [!project.isBookmarked, team.name, project.name];
    });

    let children = projectList.map(([team, project]) => {
      return this.getProjectNode(team, project, this.state.filter, hasSingleTeam);
    });

    return (
      <div className="project-select" ref="container">
        {activeProject ?
          this.getLinkNode(activeTeam, activeProject)
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
              onBlur={this.onFilterBlur}
              ref="filter" />
          </li>
          {children}
        </DropdownLink>
      </div>
    );
  }
});

export default ProjectSelector;
