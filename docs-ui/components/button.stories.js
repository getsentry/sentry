import React from 'react';
import {storiesOf} from '@storybook/react';
import {action} from '@storybook/addon-actions';

import DetailedError from 'sentry-ui/errors/detailedError';

// eslint-disable-next-line
storiesOf('Error.Detailed')
  .addWithInfo('default', 'Displays a detailed error message', () => (
    <DetailedError heading="Error heading" message="Error message" />
  ))
  .addWithInfo(
    'with retry',
    'If `onRetry` callback is supplied, will show a "Retry" button in footer',
    () => (
      <DetailedError
        onRetry={action('onRetry')}
        heading="Error heading"
        message="Error message"
      />
    )
  )
  .addWithInfo('hides support links', 'Hides support links', () => (
    <DetailedError
      onRetry={action('onRetry')}
      hideSupportLinks
      heading="Error heading"
      message="Error message"
    />
  ))
  .addWithInfo('hides footer', 'Hides footer if no support links or retry', () => (
    <DetailedError hideSupportLinks heading="Error heading" message="Error message" />
  ));
