import React from 'react';

import {explodeSlug} from 'app/utils';
import BaseAvatar from 'app/components/avatar/baseAvatar';
import SentryTypes from 'app/proptypes';

class ProjectAvatar extends React.Component {
  static propTypes = {
    project: SentryTypes.Project.isRequired,
    ...BaseAvatar.propTypes,
  };

  render() {
    let {project, ...props} = this.props;
    if (!project) return null;
    let slug = (project && project.slug) || '';
    let title = explodeSlug(slug);

    return (
      <BaseAvatar
        {...props}
        type={(project.avatar && project.avatar.avatarType) || 'letter_avatar'}
        uploadPath="project-avatar"
        uploadId={project.avatar && project.avatar.avatarUuid}
        letterId={slug}
        tooltip={slug}
        title={title}
      />
    );
  }
}
export default ProjectAvatar;
