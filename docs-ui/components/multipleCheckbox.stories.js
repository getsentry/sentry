import React from 'react';
import {action} from '@storybook/addon-actions';

import MultipleCheckbox from 'app/views/settings/components/forms/controls/multipleCheckbox';

export default {
  title: 'Core/Forms/Controls',
  component: MultipleCheckbox,
  args: {
    choices: [
      ['foo', 'Foo'],
      ['bar', 'Bar'],
      ['baz', 'Baz'],
      ['quux', 'Quux'],
    ],
    value: ['bar'],
    onChange: (v, e) => {
      action('MultipleCheckbox change')(v, e);
    },
  },
};

export const _MultipleCheckbox = ({...args}) => <MultipleCheckbox {...args} />;

_MultipleCheckbox.storyName = 'MultipleCheckbox';
_MultipleCheckbox.parameters = {
  docs: {
    description: {
      story: 'Multiple Checkbox Control (controlled only atm)',
    },
  },
};
