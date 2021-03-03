import React from 'react';

import Pill from 'app/components/pill';
import Pills from 'app/components/pills';

export default {
  title: 'Core/Tags/Pills',
};

export const Default = () => (
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
);

Default.storyName = 'Pills';
Default.parameters = {
  docs: {
    description: {
      story: 'When you have key/value data but are tight on space.',
    },
  },
};
