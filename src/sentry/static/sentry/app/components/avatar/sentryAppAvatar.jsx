import React from 'react';

import BaseAvatar from 'app/components/avatar/baseAvatar';
import SentryTypes from 'app/sentryTypes';

class SentryAppAvatar extends React.Component {
  static propTypes = {
    sentryApp: SentryTypes.SentryApplication.isRequired,
    ...BaseAvatar.propTypes,
  };

  render() {
    let {sentryApp, ...props} = this.props;
    if (!sentryApp) return null;

    return (
      <BaseAvatar
        {...props}
        type={'letter_avatar'}
        uploadPath="avatar"
        uploadId={''}
        letterId={sentryApp.uuid}
        tooltip={sentryApp.name}
        title={sentryApp.name}
      />
    );
  }
}
export default SentryAppAvatar;
