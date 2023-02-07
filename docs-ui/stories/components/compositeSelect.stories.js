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
  disabled: false,
  menuTitle: '',
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
_CompositeSelect.argTypes = {
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
