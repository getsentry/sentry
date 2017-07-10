import React from 'react';
import {storiesOf} from '@storybook/react';
import {action} from '@storybook/addon-actions';

import Button from 'sentry-ui/buttons/button';

// eslint-disable-next-line
storiesOf('Button')
  .addWithInfo('primary', 'Action button', () => (
    <Button priority="primary" size="lg" onClick={action('button-click')}>
      Click it
    </Button>
  ))
  .addWithInfo('danger', 'Button that will destroy something', () => (
    <Button priority="danger" size="sm" onClick={action('💥')}>
      Click it
    </Button>
  ))
  .addWithInfo('disabled', 'Disabled button', () => (
    <Button disabled size="xs" onClick={action('💥')}>
      Don't click it!
    </Button>
  ));
