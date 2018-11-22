import React from 'react';
import {storiesOf} from '@storybook/react';
import {action} from '@storybook/addon-actions';
import {withInfo} from '@storybook/addon-info';

import DetailedError from 'app/components/errors/detailedError';

// eslint-disable-next-line
storiesOf('UI|DetailedError', module)
  .add(
    'default',
    withInfo('Displays a detailed error message')(() => (
      <DetailedError heading="Error heading" message="Error message" />
    ))
  )
  .add(
    'with retry',
    withInfo(
      'If `onRetry` callback is supplied, will show a "Retry" button in footer'
    )(() => (
      <DetailedError
        onRetry={action('onRetry')}
        heading="Error heading"
        message="Error message"
      />
    ))
  )
  .add(
    'hides support links',
    withInfo('Hides support links')(() => (
      <DetailedError
        onRetry={action('onRetry')}
        hideSupportLinks
        heading="Error heading"
        message="Error message"
      />
    ))
  )
  .add(
    'hides footer',
    withInfo('Hides footer if no support links or retry')(() => (
      <DetailedError hideSupportLinks heading="Error heading" message="Error message" />
    ))
  );
