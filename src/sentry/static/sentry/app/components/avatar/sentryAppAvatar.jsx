import React from 'react';

import BaseAvatar from 'app/components/avatar/baseAvatar';

class SentryAppAvatar extends React.Component {
  static propTypes = {
    sentryApp: PropTypes.object.isRequired,
    ...BaseAvatar.propTypes,
  };

  render() {
    let {sentryApp, ...props} = this.props;
    if (!sentryApp) return null;

    return (
      <BaseAvatar
        {...props}
        type={'letter_avatar'}
        uploadPath="sentry-app-avatar"
        uploadId={false}
        letterId={sentryApp.uuid}
        tooltip={sentryApp.name}
        title={sentryApp.name}
      />
    );
  }
}
export default SentryAppAvatar;
