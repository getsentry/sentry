import React from 'react';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';
import styled from '@emotion/styled';

import UserMisery from 'app/components/userMisery';

storiesOf('Other|ScoreBar/UserMisery', module)
  .add(
    'default',
    withInfo(
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
    ))
  )
  .add(
    'large',
    withInfo('Both length and height of the component can be modified')(() => (
      <Container>
        <UserMisery
          bars={40}
          barHeight={30}
          miseryLimit={300}
          miserableUsers={75}
          totalUsers={100}
        />
      </Container>
    ))
  )
  .add(
    'empty',
    withInfo('Empty state')(() => (
      <Container>
        <UserMisery
          bars={10}
          barHeight={20}
          miseryLimit={300}
          miserableUsers={0}
          totalUsers={0}
        />
      </Container>
    ))
  )
  .add(
    'full',
    withInfo('Full state')(() => (
      <Container>
        <UserMisery
          bars={10}
          barHeight={20}
          miseryLimit={300}
          miserableUsers={1000}
          totalUsers={1000}
        />
      </Container>
    ))
  );

const Container = styled('div')`
  display: inline-block;
`;
