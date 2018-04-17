import PropTypes from 'prop-types';
import React from 'react';

import {explodeSlug} from 'app/utils';
import BaseAvatar from 'app/components/avatar/baseAvatar';

class SlugAvatar extends React.Component {
  static propTypes = {
    model: PropTypes.shape({
      slug: PropTypes.string.isRequired,
    }),
    ...BaseAvatar.propTypes,
  };

  render() {
    let {model, ...props} = this.props;
    if (!model) return null;
    let slug = (model && model.slug) || '';

    // Letter avatar uses letters from first 2 words
    // Previously we used displayName (which allows spaces) but is deprecated in
    // favor of using slugs only (which do not allow spaces)
    let title = explodeSlug(slug);

    return (
      <BaseAvatar
        {...props}
        type={(model.avatar && model.avatar.avatarType) || 'letter_avatar'}
        uploadId={model.avatar && model.avatar.avatarUuid}
        letterId={slug}
        tooltip={slug}
        title={title}
      />
    );
  }
}
export default SlugAvatar;
