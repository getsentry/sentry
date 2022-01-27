import {action} from '@storybook/addon-actions';

import LinkWithConfirmation from 'sentry/components/links/linkWithConfirmation';

export default {
  title: 'Views/Modals/Link With Confirmation Modal',
};

export const __LinkWithConfirmation = () => (
  <div>
    <LinkWithConfirmation message="Message" title="Title" onConfirm={action('confirmed')}>
      Link With Confirmation
    </LinkWithConfirmation>
  </div>
);

__LinkWithConfirmation.storyName = 'Link With Confirmation Modal';
__LinkWithConfirmation.parameters = {
  docs: {
    description: {
      story: 'A link (<a>) that opens a confirmation modal.',
    },
  },
};
