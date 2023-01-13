import {useState} from 'react';
import {action} from '@storybook/addon-actions';

import MultipleCheckbox from 'sentry/components/forms/controls/multipleCheckbox';

export default {
  title: 'Components/Forms/Controls/Multiple Checkbox',
  component: MultipleCheckbox,
  args: {
    disabled: false,
    name: 'multiple-checkbox-example',
  },
};

export const _MultipleCheckbox = ({...args}) => {
  const [value, setValue] = useState(['bar']);

  return (
    <MultipleCheckbox
      value={value}
      onChange={(newValue, e) => {
        setValue(newValue);
        action('MultipleCheckbox change')(newValue, e);
      }}
      {...args}
    >
      <MultipleCheckbox.Item value="foo">Foo</MultipleCheckbox.Item>
      <MultipleCheckbox.Item value="bar">Bar</MultipleCheckbox.Item>
      <MultipleCheckbox.Item value="baz">Baz</MultipleCheckbox.Item>
      <MultipleCheckbox.Item value="quux">Quux</MultipleCheckbox.Item>
    </MultipleCheckbox>
  );
};

_MultipleCheckbox.storyName = 'Multiple Checkbox';
_MultipleCheckbox.parameters = {
  docs: {
    description: {
      story: 'Multiple Checkbox Control (controlled only atm)',
    },
  },
};
