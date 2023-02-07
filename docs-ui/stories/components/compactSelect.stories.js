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
  disabled: false,
  multiple: false,
  menuTitle: '',
  disallowEmptySelection: false,
  isSearchable: false,
  isLoading: false,
  isClearable: false,
  placeholder: 'Search…',
  shouldCloseOnBlur: true,
  isDismissable: true,
  offset: 8,
  crossOffset: 0,
  containerPadding: 8,
  placement: 'bottom left',
  triggerProps: {
    prefix: 'Prefix',
  },
};
_CompactSelect.argTypes = {
  placement: {
    options: [
      'top',
      'bottom',
      'left',
      'right',
      'top left',
      'top right',
      'bottom left',
      'bottom right',
      'left top',
      'left bottom',
      'right top',
      'right bottom',
    ],
    control: {type: 'radio'},
  },
};
