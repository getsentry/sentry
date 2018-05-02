import React from 'react';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';
import {action} from '@storybook/addon-actions';

import TextCopyInput from 'app/views/settings/components/forms/textCopyInput';

storiesOf('TextCopyInput', module).add(
  'default',
  withInfo('Description')(() => (
    <TextCopyInput onCopy={action('Copied!')}>Value to be copied </TextCopyInput>
  ))
);
