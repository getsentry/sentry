import React from 'react';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';
import {action} from '@storybook/addon-actions';

import Confirm from 'sentry-ui/confirm';
import Button from 'sentry-ui/buttons/button';

storiesOf('Confirm/Confirm', module).add(
  'default',
  withInfo({
    text:
      'Component whose child is rendered as the "action" component that when clicked opens the "Confirm Modal"',
    propTablesExclude: [Button],
  })(() => (
    <div>
      <Confirm
        onConfirm={action('confirmed')}
        message="Are you sure you want to do this?"
      >
        <Button priority="primary">Confirm on Button click</Button>
      </Confirm>
    </div>
  ))
);
