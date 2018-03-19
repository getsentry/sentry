import PropTypes from 'prop-types';
import React from 'react';

import BaseAvatar from './baseAvatar';

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
    let title = (model && model.slug) || '';

    return (
      <BaseAvatar
        {...props}
        type="letter_avatar"
        letterId={title}
        tooltip={title}
        title={title}
      />
    );
  }
}
export default SlugAvatar;
