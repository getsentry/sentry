import React from 'react';
import {storiesOf} from '@storybook/react';
import {action} from '@storybook/addon-actions';
import {withInfo} from '@storybook/addon-info';

import LinkWithConfirmation from 'app/components/linkWithConfirmation';

storiesOf('Links/LinkWithConfirmation', module).add(
  'default',
  withInfo('A link (<a>) that opens a confirmation modal.')(() => (
    <div>
      <LinkWithConfirmation
        message="Message"
        title="Titlte"
        onConfirm={action('confirmed')}
      >
        Link With Confirmation
      </LinkWithConfirmation>
    </div>
  ))
);

storiesOf('Confirm/LinkWithConfirmation', module).add(
  'default',
  withInfo('A link (<a>) that opens a confirmation modal.')(() => (
    <div>
      <LinkWithConfirmation
        message="Message"
        title="Titlte"
        onConfirm={action('confirmed')}
      >
        Link With Confirmation
      </LinkWithConfirmation>
    </div>
  ))
);
