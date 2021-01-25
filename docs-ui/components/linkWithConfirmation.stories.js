import React from 'react';
import {action} from '@storybook/addon-actions';

import LinkWithConfirmation from 'app/components/links/linkWithConfirmation';

export default {
  title: 'UI/Confirm',
};

export const __LinkWithConfirmation = () => (
  <div>
    <LinkWithConfirmation message="Message" title="Title" onConfirm={action('confirmed')}>
      Link With Confirmation
    </LinkWithConfirmation>
  </div>
);

__LinkWithConfirmation.storyName = 'LinkWithConfirmation';
__LinkWithConfirmation.parameters = {
  docs: {
    description: {
      story: 'A link (<a>) that opens a confirmation modal.',
    },
  },
};
