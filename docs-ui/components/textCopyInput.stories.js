import {withInfo} from '@storybook/addon-info';
import {action} from '@storybook/addon-actions';

import TextCopyInput from 'app/views/settings/components/forms/textCopyInput';

export default {
  title: 'Utilities/TextCopyInput',
};

export const _TextCopyInput = withInfo('Description')(() => (
  <TextCopyInput onCopy={action('Copied!')}>Value to be copied </TextCopyInput>
));

_TextCopyInput.story = {
  name: 'TextCopyInput',
};
