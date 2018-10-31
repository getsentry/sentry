import React from 'react';

import PropTypes from 'prop-types';
import BaseAvatar from 'app/components/avatar/baseAvatar';
<<<<<<< HEAD
import SentryTypes from 'app/sentryTypes';

class SentryAppAvatar extends React.Component {
  static propTypes = {
    sentryApp: SentryTypes.SentryApplication.isRequired,
=======

class SentryAppAvatar extends React.Component {
  static propTypes = {
    sentryApp: PropTypes.object.isRequired,
>>>>>>> add redirect_url and overview to ui and letter avatar
    ...BaseAvatar.propTypes,
  };

  render() {
    let {sentryApp, ...props} = this.props;
    if (!sentryApp) return null;

    return (
      <BaseAvatar
        {...props}
        type={'letter_avatar'}
<<<<<<< HEAD
        uploadPath="avatar"
        uploadId={''}
=======
        uploadPath="sentry-app-avatar"
        uploadId={false}
>>>>>>> add redirect_url and overview to ui and letter avatar
        letterId={sentryApp.uuid}
        tooltip={sentryApp.name}
        title={sentryApp.name}
      />
    );
  }
}
export default SentryAppAvatar;
