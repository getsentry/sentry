import React from 'react';
import {action} from '@storybook/addon-actions';
import {withInfo} from '@storybook/addon-info';

import LinkWithConfirmation from 'app/components/links/linkWithConfirmation';

export default {
  title: 'UI/Confirm',
};

export const __LinkWithConfirmation = withInfo(
  'A link (<a>) that opens a confirmation modal.'
)(() => (
  <div>
    <LinkWithConfirmation message="Message" title="Title" onConfirm={action('confirmed')}>
      Link With Confirmation
    </LinkWithConfirmation>
  </div>
));

__LinkWithConfirmation.story = {
  name: 'LinkWithConfirmation',
};
