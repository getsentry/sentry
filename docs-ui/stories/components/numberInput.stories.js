import NumberInput from 'sentry/components/numberInput';

export default {
  title: 'Components/Forms/Controls/Number Input',
  args: {
    defaultValue: 5,
    min: 0,
    max: 100,
    disabled: false,
    required: false,
    readOnly: false,
    monospace: false,
    size: 'md',
  },
  argTypes: {
    value: {type: 'number'},
    defaultValue: {type: 'number'},
    size: {
      options: ['md', 'sm', 'xs'],
      control: {type: 'inline-radio'},
    },
  },
};

export const _NumberInput = args => <NumberInput {...args} />;
