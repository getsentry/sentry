import {action} from '@storybook/addon-actions';
import {withInfo} from '@storybook/addon-info';

import Clipboard from 'app/components/clipboard';

export default {
  title: 'UI/Clipboard',
};

export const Default = withInfo('Copy text to clipboard')(() => (
  <div>
    <Clipboard
      value="This will be copied to clipboard"
      onSuccess={action('Copied to clipboard')}
      onError={action('Failed copy to clipboard')}
    >
      <span priority="primary">Click to Copy</span>
    </Clipboard>
  </div>
));

Default.story = {
  name: 'default',
};
