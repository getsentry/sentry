import PropTypes from 'prop-types';
import React from 'react';

export default class ProjectLabel extends React.PureComponent {
  static propTypes = {
    project: PropTypes.object,
  };

  render() {
    let {project} = this.props;

    return (
      <span className="project-label" {...this.props}>
        <span className="project-name">{project.slug}</span>
      </span>
    );
  }
}
