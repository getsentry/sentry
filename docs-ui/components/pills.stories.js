import React from 'react';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';

import Pills from 'app/components/pills';
import Pill from 'app/components/pill';

storiesOf('UI|Pills', module).add(
  'all',
  withInfo('When you have key/value data but are tight on space.')(() => (
    <Pills>
      <Pill name="key" value="value" />
      <Pill name="good" value={true}>
        thing
      </Pill>
      <Pill name="bad" value={false}>
        thing
      </Pill>
      <Pill name="generic">thing</Pill>
    </Pills>
  ))
);
