import React from 'react';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';
import {action} from '@storybook/addon-actions';

import Confirm from 'app/components/confirm';
import Button from 'app/components/button';

storiesOf('UI|Confirm', module).add(
  'Confirm',
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
