import React from 'react';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';
import {action} from '@storybook/addon-actions';

import ConfirmDelete from 'app/components/confirmDelete';
import Button from 'app/components/button';

storiesOf('UI|Confirm', module).add(
  'ConfirmDelete',
  withInfo({
    text: 'A Confirm Modal that requires a user to enter a confirmation string.',
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
