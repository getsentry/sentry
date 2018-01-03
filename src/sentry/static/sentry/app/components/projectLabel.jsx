import PropTypes from 'prop-types';
import React from 'react';

export default class ProjectLabel extends React.PureComponent {
  static propTypes = {
    project: PropTypes.object,
    organization: PropTypes.object,
  };

  render() {
    let project = this.props.project;
    return (
      <span className="project-label">
        <span className="project-name">{project.name}</span>
      </span>
    );
  }
}
