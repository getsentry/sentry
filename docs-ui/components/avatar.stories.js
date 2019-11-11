import React from 'react';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';
import {boolean} from '@storybook/addon-knobs';

import Avatar from 'app/components/avatar';

const USER = {
  id: 1,
  name: 'Jane Bloggs',
  email: 'janebloggs@example.com',
};

// eslint-disable-next-line
storiesOf('UI|Avatar', module)
  .add(
    'Letters',
    withInfo('This is the default avatar')(() => {
      const hasTooltip = boolean('Display a tooltip', false);
      const user = Object.assign({}, USER);
      return <Avatar user={user} hasTooltip={hasTooltip} />;
    })
  )
  .add(
    'Gravatar',
    withInfo('Avatar source from gravatar')(() => {
      const hasTooltip = boolean('Display a tooltip', false);
      const user = {
        id: 2,
        name: 'Ben Vinegar',
        email: 'ben@benv.ca',
        avatar: {
          avatarType: 'gravatar',
          avatarUuid: '2d641b5d-8c74-44de-9cb6-fbd54701b35e',
        },
      };
      return <Avatar user={user} hasTooltip={hasTooltip} />;
    })
  )
  .add(
    'Uploaded Image',
    withInfo('Uploaded image')(() => {
      const hasTooltip = boolean('Display a tooltip', false);
      const user = Object.assign({}, USER, {
        avatar: {
          avatarType: 'upload',
          avatarUuid: '51e63edabf31412aa2a955e9cf2c1ca0',
        },
      });
      return <Avatar user={user} hasTooltip={hasTooltip} />;
    })
  )
  .add(
    'Team Avatar',
    withInfo('Avatar for teams')(() => {
      const hasTooltip = boolean('Display a tooltip', false);
      const team = {
        name: 'Captain Planet',
        slug: 'captain-planet',
      };
      return <Avatar team={team} hasTooltip={hasTooltip} />;
    })
  );
