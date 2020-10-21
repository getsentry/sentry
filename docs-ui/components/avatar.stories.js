import {withInfo} from '@storybook/addon-info';
import {boolean} from '@storybook/addon-knobs';

import Avatar from 'app/components/avatar';

const USER = {
  id: 1,
  name: 'Jane Bloggs',
  email: 'janebloggs@example.com',
};

export default {
  title: 'Core/Avatar',
};

export const Letters = withInfo('This is the default avatar')(() => {
  const hasTooltip = boolean('Display a tooltip', false);
  const user = Object.assign({}, USER);
  return <Avatar user={user} hasTooltip={hasTooltip} />;
});

export const Gravatar = withInfo('Avatar source from gravatar')(() => {
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
});

export const UploadedImage = withInfo('Uploaded image')(() => {
  const hasTooltip = boolean('Display a tooltip', false);
  const user = Object.assign({}, USER, {
    avatar: {
      avatarType: 'upload',
      avatarUuid: '51e63edabf31412aa2a955e9cf2c1ca0',
    },
  });
  return <Avatar user={user} hasTooltip={hasTooltip} />;
});

export const TeamAvatar = withInfo('Avatar for teams')(() => {
  const hasTooltip = boolean('Display a tooltip', false);
  const team = {
    name: 'Captain Planet',
    slug: 'captain-planet',
  };
  return <Avatar team={team} hasTooltip={hasTooltip} />;
});
