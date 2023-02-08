import CompactSelect from 'sentry/components/compactSelect';

export default {
  title: 'Components/Compact Select',
  component: CompactSelect,
};

export const _CompactSelect = props => (
  <CompactSelect
    defaultValue={props.multiple ? ['choice_one'] : 'choice_one'}
    options={[
      {
        label: 'Section 1',
        options: [
          {value: 'choice_one', label: 'Choice One'},
          {value: 'choice_two', label: 'Choice Two'},
        ],
      },
      {
        label: 'Section 2',
        options: [
          {value: 'choice_three', label: 'Choice Three'},
          {value: 'choice_four', label: 'Choice Four'},
        ],
      },
    ]}
    {...props}
  />
);

_CompactSelect.args = {
  size: 'md',
  value: undefined,
  defaultValue: undefined,
  onChange: undefined,
  disabled: false,
  multiple: false,
  isOptionDisabled: undefined,
  disallowEmptySelection: undefined,
  menuTitle: undefined,
  loading: false,
  clearable: false,
  onClear: undefined,
  searchable: false,
  searchPlaceholder: undefined,
  onSearch: undefined,
  position: 'bottom-start',
  offset: 8,
  crossOffset: 0,
  containerPadding: 8,
  menuWidth: undefined,
  maxMenuWidth: undefined,
  maxMenuHeight: undefined,
  closeOnSelect: undefined,
  shouldCloseOnBlur: undefined,
  isDismissable: undefined,
  preventOverflowOptions: undefined,
  triggerProps: {
    prefix: 'Prefix',
  },
};
_CompactSelect.argTypes = {
  size: {control: {type: 'inline-radio'}},
  value: {control: {type: 'text'}},
  defaultValue: {control: {type: 'text'}},
  menuTitle: {control: {type: 'text'}},
  options: {control: false},
  searchPlaceholder: {control: {type: 'text'}},
  position: {
    options: [
      'top',
      'bottom',
      'left',
      'right',
      'top-start',
      'top-end',
      'bottom-start',
      'bottom-end',
      'left-start',
      'left-end',
      'right-start',
      'right-end',
    ],
    control: {type: 'inline-radio'},
  },
  disallowEmptySelection: {control: {type: 'boolean'}},
  closeOnSelect: {control: {type: 'boolean'}},
  shouldCloseOnBlur: {control: {type: 'boolean'}},
  isDismissable: {control: {type: 'boolean'}},
  menuWidth: {control: {type: 'number'}},
  maxMenuWidth: {control: {type: 'number'}},
  maxMenuHeight: {control: {type: 'number'}},
  triggerLabel: {control: {type: 'text'}},
};
