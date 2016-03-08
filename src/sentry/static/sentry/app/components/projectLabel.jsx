import React from 'react';
import PureRenderMixin from 'react-addons-pure-render-mixin';
import OrganizationState from '../mixins/organizationState';

const ProjectLabel = React.createClass({
  propTypes: {
    project: React.PropTypes.object
  },

  mixins: [
    PureRenderMixin,
    OrganizationState
  ],

  render() {
    let project = this.props.project;
    let features = this.getFeatures();
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
