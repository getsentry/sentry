import React from 'react';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';

import Highlight from 'app/components/highlight';

storiesOf('Highlight', module).add(
  'default',
  withInfo('Highlights a string within another string')(() => (
    <Highlight text="ILL">billy@sentry.io</Highlight>
  ))
);
