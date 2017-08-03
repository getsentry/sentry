import React from 'react';
import {storiesOf} from '@storybook/react';
import {action} from '@storybook/addon-actions';

import LoadingError from 'sentry-ui/loadingError';

// eslint-disable-next-line
storiesOf('LoadingError')
  .addWithInfo('default', 'Loading error with default message', () => (
    <LoadingError onRetry={action('retry')} />
  ))
  .addWithInfo('custom message', 'Loading error with custom message', () => (
    <LoadingError message="Data failed to load" onRetry={action('retry')} />
  ));
