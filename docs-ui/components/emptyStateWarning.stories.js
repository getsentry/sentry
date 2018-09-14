import React from 'react';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';

import EmptyStateWarning from 'app/components/emptyStateWarning';

storiesOf('UI|EmptyStateWarning', module).add(
  'default',
  withInfo('Default')(() => (
    <EmptyStateWarning data="https://example.org/foo/bar/">
      <p>There are no events found!</p>
    </EmptyStateWarning>
  ))
);
