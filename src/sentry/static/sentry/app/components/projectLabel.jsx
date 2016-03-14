import React from 'react';
import PureRenderMixin from 'react-addons-pure-render-mixin';

const ProjectLabel = React.createClass({
  propTypes: {
    project: React.PropTypes.object,
    organization: React.PropTypes.object,
  },

  mixins: [
    PureRenderMixin
  ],

  render() {
    let project = this.props.project;
    let features = new Set(this.props.organization.features);
    return (
      <span className="project-label">
        <span className="project-name">{project.name}</span>
        {features.has('callsigns') && project.callSign
          ? <span className="callsign-addon" style={{
            color: project.color
          }}>{project.callSign}</span>
          : null}
      </span>
    );
  }
});

export default ProjectLabel;
