import React from 'react';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';

import EmptyStateWarning from 'sentry-ui/emptyStateWarning';

storiesOf('EmptyStateWarning', module).add(
  'default',
  withInfo('Default')(() => (
    <EmptyStateWarning data="https://example.org/foo/bar/">
      <p>There are no events found!</p>
    </EmptyStateWarning>
  ))
);
