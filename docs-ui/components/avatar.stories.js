import React from 'react';
import styled from '@emotion/styled';
import {select} from '@storybook/addon-knobs';

import Avatar from 'app/components/avatar';
import SuggestedAvatarStack from 'app/components/avatar/suggestedAvatarStack';
import TeamStore from 'app/stores/teamStore';

const USER = {
  id: 1,
  name: 'Jane Bloggs',
  email: 'janebloggs@example.com',
};

export default {
  title: 'Core/Avatar',
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

export const SuggestedAvatars = () => {
  // Setup mock data
  const exampleUserActor = {
    type: 'user',
    id: '1',
    name: 'Jane Bloggs',
  };
  const exampleTeam = {
    id: '2',
    name: 'Captain Planet',
    slug: 'captain-planet',
    isMember: true,
    hasAccess: true,
    isPending: false,
    memberCount: 1,
    avatar: 'letter_avatar',
  };
  const exampleTeamActor = {
    type: 'team',
    id: exampleTeam.id,
    name: exampleTeam.name,
  };
  TeamStore.loadInitialData([exampleTeam]);

  // Provide knob options
  const suggestionsWithUser = [exampleUserActor, exampleTeamActor, exampleTeamActor];
  const suggestionsWithTeam = [exampleTeamActor, exampleUserActor, exampleTeamActor];
  const options = {
    User: suggestionsWithUser,
    Team: suggestionsWithTeam,
  };
  const suggestedOwners = select('Suggested Owner Type', options, suggestionsWithTeam);

  return (
    <SuggestedAvatarContainer>
      <SuggestedAvatarStack owners={suggestedOwners} />
    </SuggestedAvatarContainer>
  );
};
SuggestedAvatars.args = {};
SuggestedAvatars.parameters = {
  docs: {
    description: {
      story: 'Suggested avatar stack',
    },
  },
};

const SuggestedAvatarContainer = styled('div')`
  width: 40px;
`;
