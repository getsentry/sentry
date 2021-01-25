import React from 'react';
import {action} from '@storybook/addon-actions';

import TextCopyInput from 'app/views/settings/components/forms/textCopyInput';

export default {
  title: 'Utilities/TextCopyInput',
  component: TextCopyInput,
  argTypes: {
    children: {
      table: {
        disable: true,
      },
    },
  },
};

export const _TextCopyInput = () => (
  <TextCopyInput onCopy={action('Copied!')}>Value to be copied </TextCopyInput>
);

_TextCopyInput.storyName = 'TextCopyInput';
