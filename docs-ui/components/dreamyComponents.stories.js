import React from 'react';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';
import {Flex} from 'grid-emotion';

import {
  BashCard,
  Issues,
  SuggestedAssignees,
  Resolution,
  Emails,
  Contributors,
} from 'sentry-dreamy-components';

storiesOf('Dreamy Components', module)
  .add('Bash Card', withInfo('An illustration of bash')(BashCard))
  .add(
    'Issues',
    withInfo('An illustration of bash')(() => (
      <Flex mt={4} mb={100} justify="center">
        <Issues style={{width: '500px'}} />
      </Flex>
    ))
  )
  .add(
    'Suggested Assignees',
    withInfo('An illustration of Suggesting an Assignee')(() => (
      <Flex mt={100} mb={120} justify="center">
        <SuggestedAssignees style={{padding: 0, fontSize: '18px'}} />
      </Flex>
    ))
  )
  .add(
    'Resolution',
    withInfo('An illustration of Resolution')(() => (
      <Flex mt={4} mb={4} justify="center">
        <Resolution />
      </Flex>
    ))
  )
  .add(
    'Emails',
    withInfo('An illustration of Emails')(() => (
      <Flex mt={4} mb={100} justify="center">
        <Emails style={{width: '500px', fontSize: '20px'}} />
      </Flex>
    ))
  )
  .add(
    'Contributors',
    withInfo('An illustration of Contributors')(() => (
      <Flex mt={4} mb={100} justify="center">
        <Contributors style={{width: '500px', fontSize: '20px'}} />
      </Flex>
    ))
  );
