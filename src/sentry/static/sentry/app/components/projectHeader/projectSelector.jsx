import React from "react";
import Router from "react-router";
import jQuery from "jquery";
import ConfigStore from "../../stores/configStore";
import DropdownLink from "../dropdownLink";
import MenuItem from "../menuItem";

var ProjectSelector = React.createClass({
  childContextTypes: {
    router: React.PropTypes.func
  },

  getChildContext() {
    return {
      router: this.props.router
    };
  },

  getInitialState() {
    return {
      filter: ''
    };
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
    setTimeout(() => this.close(), 200);
  },

  close() {
    this.setState({ filter: '' });
    // dropdownLink might not exist because we try to close within
    // onFilterBlur above after a timeout. My hunch is that sometimes
    // this DOM element is removed within the 200ms, so we error out.
    this.refs.dropdownLink && this.refs.dropdownLink.close();
  },

  highlight(text, highlightText) {
    if (!highlightText) {
      return text;
    }
    highlightText = highlightText.toLowerCase();
    var idx = text.toLowerCase().indexOf(highlightText);
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

  getProjectNode(team, project, highlightText, hasSingleTeam) {
    var org = this.props.organization;
    var projectRouteParams = {
      orgId: org.slug,
      projectId: project.slug
    };

    var label = this.getProjectLabel(team, project, hasSingleTeam);

    if (!this.props.router) {
      return (
        <MenuItem key={project.slug} href={this.getRawLink(project)}
            linkClassName={project.slug == this.props.projectId && 'active'}>
          {this.highlight(label, highlightText)}
        </MenuItem>
      );
    }

    return (
      <MenuItem key={project.slug} to="projectDetails"
            params={projectRouteParams}>
        {this.highlight(label, highlightText)}
      </MenuItem>
    );
  },

  getProjectLabel(team, project, hasSingleTeam) {
    var label = project.name;
    if (!hasSingleTeam && label.indexOf(team.name) === -1) {
      label = team.name + ' / ' + project.name;
    }
    return label;
  },

  getRawLink(project) {
    var org = this.props.organization;
    var urlPrefix = ConfigStore.get('urlPrefix');
    return urlPrefix + '/' + org.slug + '/' + project.slug + '/';
  },

  getLinkNode(team, project) {
    var org = this.props.organization;
    var label = this.getProjectLabel(team, project);

    if (!this.props.router) {
      return (
        <a href={this.getRawLink(project)}>{label}</a>
      );
    }

    var projectRouteParams = {
      orgId: org.slug,
      projectId: project.slug
    };

    return (
      <Router.Link to="stream" params={projectRouteParams}>{label}</Router.Link>
    );
  },

  onOpen(evt) {
    this.refs.filter.getDOMNode().focus();
  },

  onClose() {
    this.setState({
      filter: ''
    });
  },

  componentDidUpdate(prevProps, prevState) {
    // XXX(dcramer): fix odd dedraw issue as of Chrome 45.0.2454.15 dev (64-bit)
    var node = jQuery(this.refs.container.getDOMNode());
    node.hide().show(0);
  },

  render() {
    var org = this.props.organization;
    var filter = this.state.filter.toLowerCase();
    var children = [];
    var activeTeam;
    var activeProject;
    var hasSingleTeam = org.teams.length === 1;

    org.teams.forEach((team) => {
      if (!team.isMember) {
        return;
      }
      team.projects.forEach((project) => {
        if (project.slug == this.props.projectId) {
          activeTeam = team;
          activeProject = project;
        }
        var fullName = [team.name, project.name, team.slug, project.slug].join(' ').toLowerCase();
        if (filter && fullName.indexOf(filter) === -1) {
          return;
        }
        children.push(this.getProjectNode(team, project, this.state.filter, hasSingleTeam));
      });
    });

    return (
      <div className="project-select" ref="container">
        {this.getLinkNode(activeTeam, activeProject)}
        <DropdownLink ref="dropdownLink" title="" topLevelClasses="project-dropdown"
            onOpen={this.onOpen} onClose={this.onClose}>
          <li className="project-filter" key="_filter">
            <input
              value={this.state.filter}
              type="text"
              placeholder="Filter projects"
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
