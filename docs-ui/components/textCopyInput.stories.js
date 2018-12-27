import React from 'react';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';
import {action} from '@storybook/addon-actions';

import TextCopyInput from 'app/views/settings/components/forms/textCopyInput';

['Utility|TextCopyInput', 'Forms|Fields'].forEach(name =>
  storiesOf(name, module).add(
    'TextCopyInput',
    withInfo('Description')(() => (
      <TextCopyInput onCopy={action('Copied!')}>Value to be copied </TextCopyInput>
    ))
  )
);
