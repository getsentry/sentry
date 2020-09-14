import React from 'react';
import {withInfo} from '@storybook/addon-info';

import Pills from 'app/components/pills';
import Pill from 'app/components/pill';

export default {
  title: 'UI/Pills',
};

export const All = withInfo('When you have key/value data but are tight on space.')(
  () => (
    <Pills>
      <Pill name="key" value="value" />
      <Pill name="good" value>
        thing
      </Pill>
      <Pill name="bad" value={false}>
        thing
      </Pill>
      <Pill name="generic">thing</Pill>
    </Pills>
  )
);

All.story = {
  name: 'all',
};
