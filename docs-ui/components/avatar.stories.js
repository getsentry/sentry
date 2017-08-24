import React from 'react';
import {storiesOf} from '@storybook/react';
// import {action} from '@storybook/addon-actions';
import {withInfo} from '@storybook/addon-info';

import Avatar from 'sentry-ui/avatar';

const USER = {
  id: 1,
  name: 'Jane Doe',
  email: 'janedoe@example.com'
};

// eslint-disable-next-line
storiesOf('Avatar', module)
  .add(
    'Letters',
    withInfo('This is the default avatar')(() => {
      let user = Object.assign({}, USER);
      return <Avatar user={user} />;
    })
  )
  .add(
    'Gravatar',
    withInfo('Avatar source from gravatar')(() => {
      let user = {
        id: 2,
        name: 'Ben Vinegar',
        email: 'ben@benv.ca',
        avatar: {
          avatarType: 'gravatar',
          avatarUuid: '2d641b5d-8c74-44de-9cb6-fbd54701b35e'
        }
      };
      return <Avatar user={user} />;
    })
  )
  .add(
    'Uploaded Image',
    withInfo('Uploaded image')(() => {
      let user = Object.assign({}, USER, {
        avatar: {
          avatarType: 'upload',
          avatarUuid: '51e63edabf31412aa2a955e9cf2c1ca0'
        }
      });
      return <Avatar user={user} />;
    })
  );
