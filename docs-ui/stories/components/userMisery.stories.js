import styled from '@emotion/styled';

import UserMisery from 'sentry/components/userMisery';

export default {
  title: 'Components/Data Visualization/Score Bar/User Misery',
  component: UserMisery,
};

const Template = ({...args}) => (
  <Container>
    <UserMisery {...args} />
  </Container>
);

export const Default = Template.bind({});
Default.storyName = 'Default';
Default.args = {
  bars: 10,
  barHeight: 20,
  miseryLimit: 300,
  miserableUsers: 75,
  totalUsers: 100,
};
Default.parameters = {
  docs: {
    description: {
      story:
        'Visualization of user misery to allow users to more easily understand performance at a glance',
    },
  },
};

export const Large = Template.bind({});
Large.storyName = 'Large';
Large.args = {
  bars: 40,
  barHeight: 30,
  miseryLimit: 300,
  miserableUsers: 75,
  totalUsers: 100,
};
Large.parameters = {
  docs: {
    description: {
      story: 'Both length and height of the component can be modified',
    },
  },
};

export const Empty = Template.bind({});
Empty.storyName = 'Empty';
Empty.args = {
  bars: 10,
  barHeight: 20,
  miseryLimit: 300,
  miserableUsers: 0,
  totalUsers: 0,
};
Empty.parameters = {
  docs: {
    description: {
      story: 'Empty state',
    },
  },
};

export const NearEmpty = Template.bind({});
NearEmpty.storyName = 'Near Empty';
NearEmpty.args = {
  bars: 10,
  barHeight: 20,
  miseryLimit: 300,
  miserableUsers: 1,
  totalUsers: 1000,
};
NearEmpty.parameters = {
  docs: {
    description: {
      story: 'Nearly empty state will still show 1 bar if there are any miserable users',
    },
  },
};

export const Full = Template.bind({});
Full.storyName = 'Full';
Full.args = {
  bars: 10,
  barHeight: 20,
  miseryLimit: 300,
  miserableUsers: 1000,
  totalUsers: 1000,
};
Full.parameters = {
  docs: {
    description: {
      story: 'Full state',
    },
  },
};

const Container = styled('div')`
  display: inline-block;
`;
