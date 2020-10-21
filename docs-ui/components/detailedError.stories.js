import {action} from '@storybook/addon-actions';
import {withInfo} from '@storybook/addon-info';

import DetailedError from 'app/components/errors/detailedError';

export default {
  title: 'Layouts/DetailedError',
};

export const Default = withInfo('Displays a detailed error message')(() => (
  <DetailedError heading="Error heading" message="Error message" />
));

Default.story = {
  name: 'default',
};

export const WithRetry = withInfo(
  'If `onRetry` callback is supplied, will show a "Retry" button in footer'
)(() => (
  <DetailedError
    onRetry={action('onRetry')}
    heading="Error heading"
    message="Error message"
  />
));

WithRetry.story = {
  name: 'with retry',
};

export const HidesSupportLinks = withInfo('Hides support links')(() => (
  <DetailedError
    onRetry={action('onRetry')}
    hideSupportLinks
    heading="Error heading"
    message="Error message"
  />
));

HidesSupportLinks.story = {
  name: 'hides support links',
};

export const HidesFooter = withInfo('Hides footer if no support links or retry')(() => (
  <DetailedError hideSupportLinks heading="Error heading" message="Error message" />
));

HidesFooter.story = {
  name: 'hides footer',
};
