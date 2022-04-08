import {action} from '@storybook/addon-actions';

import TextCopyInput from 'sentry/components/forms/textCopyInput';

export default {
  title: 'Utilities/Copy/Input',
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

_TextCopyInput.storyName = 'Input';
