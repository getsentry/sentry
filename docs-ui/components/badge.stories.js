import React from 'react';
import {storiesOf} from '@storybook/react';
// import {action} from '@storybook/addon-actions';
import {withInfo} from '@storybook/addon-info';

import Badge from 'app/components/badge';

storiesOf('UI|Badge', module).add(
  'default',
  withInfo('Used to display numbers in a "badge"')(() => (
    <div>
      <div>
        Normal <Badge text="0" />
      </div>
      <div>
        New <Badge text="50" priority="new" />
      </div>
    </div>
  ))
);
