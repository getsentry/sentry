import React from 'react';
import {storiesOf} from '@storybook/react';
// import {action} from '@storybook/addon-actions';

import Button from 'sentry-ui/buttons/button';

// eslint-disable-next-line
storiesOf('Buttons')
  .addWithInfo('priorities', 'Different button priorities', () => (
    <div>
      <Button priority="primary">
        Primary Button
      </Button>
      <Button priority="danger">
        Danger Button
      </Button>
    </div>
  ))
  .addWithInfo('sizes', 'Different buttons sizes', () => (
    <div>
      <Button size="xs">
        Extra Small
      </Button>
      <Button size="sm">
        Small
      </Button>
      <Button>
        Normal
      </Button>
      <Button size="lg">
        Large
      </Button>
    </div>
  ));
