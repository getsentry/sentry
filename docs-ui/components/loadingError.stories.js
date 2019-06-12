import React from 'react';
import {storiesOf} from '@storybook/react';
import {action} from '@storybook/addon-actions';
import {withInfo} from '@storybook/addon-info';

import LoadingError from 'app/components/loadingError';

storiesOf('UI|Loaders/LoadingError', module)
  .add(
    'default',
    withInfo('Loading error with default message')(() => (
      <LoadingError onRetry={action('retry')} />
    ))
  )
  .add(
    'custom message',
    withInfo('Loading error with custom message')(() => (
      <LoadingError message="Data failed to load" onRetry={action('retry')} />
    ))
  );
