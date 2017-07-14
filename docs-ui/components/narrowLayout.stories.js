import React from 'react';
import {storiesOf} from '@storybook/react';
// import {action} from '@storybook/addon-actions';

import NarrowLayout from 'sentry-ui/narrowLayout';

storiesOf('NarrowLayout').addWithInfo('', '', () => (
  <NarrowLayout>
    Narrow Layout
  </NarrowLayout>
));
