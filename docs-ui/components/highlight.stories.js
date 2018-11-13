import React from 'react';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';

import Highlight from 'app/components/highlight';

storiesOf('Utility|Highlight', module).add(
  'Highlight a substring',
  withInfo('Highlights a string within another string')(() => (
    <Highlight text="ILL">billy@sentry.io</Highlight>
  ))
);
