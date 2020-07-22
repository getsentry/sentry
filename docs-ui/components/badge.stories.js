import React from 'react';
// import {action} from '@storybook/addon-actions';
import {withInfo} from '@storybook/addon-info';

import Badge from 'app/components/badge';

export default {
  title: 'UI/Badge',
};

export const Default = withInfo('Used to display numbers in a "badge"')(() => (
  <div>
    <div>
      Normal <Badge text="0" />
    </div>
    <div>
      New <Badge text="50" priority="new" />
    </div>
  </div>
));

Default.story = {
  name: 'default',
};
