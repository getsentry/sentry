import React from 'react';
import PureRenderMixin from 'react-addons-pure-render-mixin';

const ProjectLabel = React.createClass({
  propTypes: {
    project: React.PropTypes.object
  },

  mixins: [
    PureRenderMixin
  ],

  render() {
    let project = this.props.project;
    return (
      <span className="project-label">
        <span className="project-name">{project.name}</span>
        {project.callSign
          ? <span className="callsign-addon">{project.callSign}</span>
          : null}
      </span>
    );
  }
});

export default ProjectLabel;
