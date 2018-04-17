import PropTypes from 'prop-types';
import React from 'react';

export default class ProjectLabel extends React.PureComponent {
  static propTypes = {
    project: PropTypes.object,
    organization: PropTypes.object,
  };

  render() {
    let {project, organization} = this.props;
    let features = organization && new Set(organization.features);

    return (
      <span className="project-label" {...this.props}>
        <span className="project-name">
          {!features || features.has('new-teams') ? project.slug : project.name}
        </span>
      </span>
    );
  }
}
