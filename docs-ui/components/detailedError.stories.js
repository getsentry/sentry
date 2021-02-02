import React from 'react';
import {action} from '@storybook/addon-actions';

import DetailedError from 'app/components/errors/detailedError';

export default {
  title: 'Layouts/DetailedError',
  component: DetailedError,
};

export const Default = () => (
  <DetailedError heading="Error heading" message="Error message" />
);

Default.storyName = 'default';
Default.parameters = {
  docs: {
    description: {
      story: 'Displays a detailed error message',
    },
  },
};

export const WithRetry = () => (
  <DetailedError
    onRetry={action('onRetry')}
    heading="Error heading"
    message="Error message"
  />
);

WithRetry.storyName = 'with retry';
WithRetry.parameters = {
  docs: {
    description: {
      story: 'If `onRetry` callback is supplied, will show a "Retry" button in footer',
    },
  },
};

export const HidesSupportLinks = () => (
  <DetailedError
    onRetry={action('onRetry')}
    hideSupportLinks
    heading="Error heading"
    message="Error message"
  />
);

HidesSupportLinks.storyName = 'hides support links';
HidesSupportLinks.parameters = {
  docs: {
    description: {
      story: 'Hides support links',
    },
  },
};

export const HidesFooter = () => (
  <DetailedError hideSupportLinks heading="Error heading" message="Error message" />
);

HidesFooter.storyName = 'hides footer';
HidesFooter.parameters = {
  docs: {
    description: {
      story: 'Hides footer if no support links or retry',
    },
  },
};
