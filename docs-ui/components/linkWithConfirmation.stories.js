import React from 'react';
import {storiesOf} from '@storybook/react';
import {action} from '@storybook/addon-actions';

import LinkWithConfirmation from 'sentry-ui/linkWithConfirmation';

// eslint-disable-next-line
storiesOf(
  'LinkWithConfirmation'
).addWithInfo('', 'A link that opens a confirmation modal.', () => (
  <div>
    <LinkWithConfirmation
      message="Message"
      title="Titlte"
      onConfirm={action('confirmed')}>
      Link With Confirmation
    </LinkWithConfirmation>
  </div>
));
