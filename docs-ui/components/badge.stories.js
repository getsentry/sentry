import React from 'react';
import {storiesOf} from '@storybook/react';
// import {action} from '@storybook/addon-actions';

import Badge from 'sentry-ui/badge';

storiesOf('Badge').addWithInfo('', 'Used to display numbers in a "badge"', () => (
  <div>
    <div>
      Normal <Badge text="0" />
    </div>
    <div>
      New <Badge text="50" isNew />
    </div>
  </div>
));
