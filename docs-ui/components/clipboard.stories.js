import React from 'react';
import {storiesOf} from '@storybook/react';
import {action} from '@storybook/addon-actions';
import {withInfo} from '@storybook/addon-info';

import Clipboard from 'app/components/clipboard';

storiesOf('UI|Clipboard', module).add(
  'default',
  withInfo('Copy text to clipboard')(() => (
    <div>
      <Clipboard
        value="This will be copied to clipboard"
        onSuccess={action('Copied to clipboard')}
        onError={action('Failed copy to clipboard')}
      >
        <span priority="primary">Click to Copy</span>
      </Clipboard>
    </div>
  ))
);
