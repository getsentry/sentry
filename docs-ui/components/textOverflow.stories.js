import React from 'react';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';

import TextOverflow from 'sentry-ui/textOverflow';

storiesOf('TextOverflow', module).add(
  'default',
  withInfo(
    'Simple component that adds "text-overflow: ellipsis" and "overflow: hidden", still depends on container styles'
  )(() => (
    <div style={{width: 50}}>
      <TextOverflow>AReallyLongTextString</TextOverflow>
    </div>
  ))
);
