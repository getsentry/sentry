import React from 'react';
import styled from '@emotion/styled';

import SuggestedAvatarStack from 'app/components/avatar/suggestedAvatarStack';
import TeamStore from 'app/stores/teamStore';

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

const suggestionsWithUser = [exampleUserActor, exampleTeamActor, exampleTeamActor];
const suggestionsWithTeam = [exampleTeamActor, exampleUserActor, exampleTeamActor];
const options = {
  User: suggestionsWithUser,
  Team: suggestionsWithTeam,
};

export default {
  title: 'Core/Avatar',
  component: SuggestedAvatarStack,
};

export const SuggestedAvatars = ({...args}) => {
  // Setup mock data
  TeamStore.loadInitialData([exampleTeam]);
  return (
    <SuggestedAvatarContainer>
      <SuggestedAvatarStack {...args} />
    </SuggestedAvatarContainer>
  );
};
SuggestedAvatars.args = {
  owners: suggestionsWithTeam,
};
SuggestedAvatars.argTypes = {
  owners: {
    control: {
      type: 'select',
      options,
    },
  },
};
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
