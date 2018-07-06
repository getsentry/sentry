import React from 'react';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';
import {action} from '@storybook/addon-actions';

import ConfirmDelete from 'app/components/confirmDelete';
import Button from 'app/components/buttons/button';

storiesOf('Confirm/ConfirmDelete', module).add(
  'default',
  withInfo({
    text:
      'Component whose child is rendered as the "action" component that when clicked opens the "Confirm Delete Modal"',
    propTablesExclude: [Button],
  })(() => (
    <div>
      <ConfirmDelete
        onConfirm={action('confirmed')}
        confirmInput="Type this out"
        message="Are you sure you want to do this?"
      >
        <Button priority="primary">Confirm on Button click</Button>
      </ConfirmDelete>
    </div>
  ))
);
