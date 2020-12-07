import React from 'react';
import styled from '@emotion/styled';
import {withInfo} from '@storybook/addon-info';
import {boolean, select} from '@storybook/addon-knobs';

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
};

export const Letters = withInfo('This is the default avatar')(() => {
  const hasTooltip = boolean('Display a tooltip', false);
  const showAsSuggested = boolean('Show as suggested avatar', false);
  const user = Object.assign({}, USER);
  return <Avatar user={user} hasTooltip={hasTooltip} suggested={showAsSuggested} />;
});

export const Gravatar = withInfo('Avatar source from gravatar')(() => {
  const hasTooltip = boolean('Display a tooltip', false);
  const showAsSuggested = boolean('Show as suggested avatar', false);
  const user = {
    id: 2,
    name: 'Ben Vinegar',
    email: 'ben@benv.ca',
    avatar: {
      avatarType: 'gravatar',
      avatarUuid: '2d641b5d-8c74-44de-9cb6-fbd54701b35e',
    },
  };
  return <Avatar user={user} hasTooltip={hasTooltip} suggested={showAsSuggested} />;
});

export const UploadedImage = withInfo('Uploaded image')(() => {
  const hasTooltip = boolean('Display a tooltip', false);
  const showAsSuggested = boolean('Show as suggested avatar', false);
  const user = Object.assign({}, USER, {
    avatar: {
      avatarType: 'upload',
      avatarUuid: '51e63edabf31412aa2a955e9cf2c1ca0',
    },
  });
  return <Avatar user={user} hasTooltip={hasTooltip} suggested={showAsSuggested} />;
});

export const TeamAvatar = withInfo('Avatar for teams')(() => {
  const hasTooltip = boolean('Display a tooltip', false);
  const showAsSuggested = boolean('Display as suggested avatar', false);
  const team = {
    name: 'Captain Planet',
    slug: 'captain-planet',
  };
  return <Avatar team={team} hasTooltip={hasTooltip} suggested={showAsSuggested} />;
});

export const SuggestedAvatars = withInfo('Suggested avatar stack')(() => {
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
});

const SuggestedAvatarContainer = styled('div')`
  width: 40px;
`;
