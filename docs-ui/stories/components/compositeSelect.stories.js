import CompositeSelect from 'sentry/components/compactSelect/composite';

export default {
  title: 'Components/Composite Select',
  component: CompositeSelect,
};

export const _CompositeSelect = props => (
  <CompositeSelect {...props}>
    <CompositeSelect.Region
      label="Region 1"
      defaultValue="choice_one"
      onChange={() => {}}
      options={[
        {value: 'choice_one', label: 'Choice One'},
        {value: 'choice_two', label: 'Choice Two'},
      ]}
    />
    <CompositeSelect.Region
      multiple
      label="Region 2"
      defaultValue={['choice_three']}
      onChange={() => {}}
      options={[
        {value: 'choice_three', label: 'Choice Three'},
        {value: 'choice_four', label: 'Choice Four'},
      ]}
    />
  </CompositeSelect>
);
_CompositeSelect.args = {
  size: 'md',
  disabled: false,
  menuTitle: undefined,
  loading: false,
  clearable: false,
  onClear: undefined,
  searchable: false,
  searchPlaceholder: undefined,
  onSearch: undefined,
  position: 'bottom-start',
  offset: 8,
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
_CompositeSelect.argTypes = {
  size: {control: {type: 'inline-radio'}},
  menuTitle: {control: {type: 'text'}},
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
  closeOnSelect: {control: {type: 'boolean'}},
  shouldCloseOnBlur: {control: {type: 'boolean'}},
  isDismissable: {control: {type: 'boolean'}},
  menuWidth: {control: {type: 'number'}},
  maxMenuWidth: {control: {type: 'number'}},
  maxMenuHeight: {control: {type: 'number'}},
  triggerLabel: {control: {type: 'text'}},
};
