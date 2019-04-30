import React from 'react';
import {storiesOf} from '@storybook/react';
import {action} from '@storybook/addon-actions';
import {withInfo} from '@storybook/addon-info';

import LinkWithConfirmation from 'app/components/links/linkWithConfirmation';

storiesOf('UI|Links', module).add(
  'LinkWithConfirmation',
  withInfo('A link (<a>) that opens a confirmation modal.')(() => (
    <div>
      <LinkWithConfirmation
        message="Message"
        title="Title"
        onConfirm={action('confirmed')}
      >
        Link With Confirmation
      </LinkWithConfirmation>
    </div>
  ))
);

storiesOf('UI|Confirm', module).add(
  'LinkWithConfirmation',
  withInfo('A link (<a>) that opens a confirmation modal.')(() => (
    <div>
      <LinkWithConfirmation
        message="Message"
        title="Title"
        onConfirm={action('confirmed')}
      >
        Link With Confirmation
      </LinkWithConfirmation>
    </div>
  ))
);
