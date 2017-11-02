import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import PureRenderMixin from 'react-addons-pure-render-mixin';

const ProjectLabel = createReactClass({
  displayName: 'ProjectLabel',

  propTypes: {
    project: PropTypes.object,
    organization: PropTypes.object,
  },

  mixins: [PureRenderMixin],

  render() {
    let project = this.props.project;
    return (
      <span className="project-label">
        <span className="project-name">{project.name}</span>
      </span>
    );
  },
});

export default ProjectLabel;
