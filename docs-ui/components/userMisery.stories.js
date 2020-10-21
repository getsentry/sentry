import {withInfo} from '@storybook/addon-info';
import styled from '@emotion/styled';

import UserMisery from 'app/components/userMisery';

export default {
  title: 'DataVisualization/ScoreBar/UserMisery',
};

export const Default = withInfo(
  'Visualization of user misery to allow users to more easily understand performance at a glance'
)(() => (
  <Container>
    <UserMisery
      bars={10}
      barHeight={20}
      miseryLimit={300}
      miserableUsers={75}
      totalUsers={100}
    />
  </Container>
));

Default.story = {
  name: 'default',
};

export const Large = withInfo('Both length and height of the component can be modified')(
  () => (
    <Container>
      <UserMisery
        bars={40}
        barHeight={30}
        miseryLimit={300}
        miserableUsers={75}
        totalUsers={100}
      />
    </Container>
  )
);

Large.story = {
  name: 'large',
};

export const Empty = withInfo('Empty state')(() => (
  <Container>
    <UserMisery
      bars={10}
      barHeight={20}
      miseryLimit={300}
      miserableUsers={0}
      totalUsers={0}
    />
  </Container>
));

Empty.story = {
  name: 'empty',
};

export const NearEmpty = withInfo(
  'Nearly empty state will still show 1 bar if there are any miserable users'
)(() => (
  <Container>
    <UserMisery
      bars={10}
      barHeight={20}
      miseryLimit={300}
      miserableUsers={1}
      totalUsers={1000}
    />
  </Container>
));

NearEmpty.story = {
  name: 'near empty',
};

export const Full = withInfo('Full state')(() => (
  <Container>
    <UserMisery
      bars={10}
      barHeight={20}
      miseryLimit={300}
      miserableUsers={1000}
      totalUsers={1000}
    />
  </Container>
));

Full.story = {
  name: 'full',
};

const Container = styled('div')`
  display: inline-block;
`;
