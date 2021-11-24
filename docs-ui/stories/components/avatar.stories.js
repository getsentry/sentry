import Avatar from 'sentry/components/avatar';

const USER = {
  id: 1,
  name: 'Jane Bloggs',
  email: 'janebloggs@example.com',
};

export default {
  title: 'Components/Avatars',
  component: Avatar,
  args: {
    hasTooltip: false,
    suggested: false,
  },
};

export const Letters = ({...args}) => {
  const user = Object.assign({}, USER);
  return <Avatar user={user} {...args} />;
};
Letters.parameters = {
  docs: {
    description: {
      story: 'This is the default avatar',
    },
  },
};

export const Gravatar = ({...args}) => {
  const user = {
    id: 2,
    name: 'Ben Vinegar',
    email: 'ben@benv.ca',
    avatar: {
      avatarType: 'gravatar',
      avatarUuid: '2d641b5d-8c74-44de-9cb6-fbd54701b35e',
    },
  };
  return <Avatar user={user} {...args} />;
};
Gravatar.parameters = {
  docs: {
    description: {
      story: 'Avatar source from gravatar',
    },
  },
};

export const UploadedImage = ({...args}) => {
  const user = Object.assign({}, USER, {
    avatar: {
      avatarType: 'upload',
      avatarUuid: '51e63edabf31412aa2a955e9cf2c1ca0',
    },
  });
  return <Avatar user={user} {...args} />;
};
UploadedImage.parameters = {
  docs: {
    description: {
      story: 'Uploaded image',
    },
  },
};

export const TeamAvatar = ({...args}) => {
  const team = {
    name: 'Captain Planet',
    slug: 'captain-planet',
  };
  return <Avatar team={team} {...args} />;
};
TeamAvatar.parameters = {
  docs: {
    description: {
      story: 'Avatar for teams',
    },
  },
};
