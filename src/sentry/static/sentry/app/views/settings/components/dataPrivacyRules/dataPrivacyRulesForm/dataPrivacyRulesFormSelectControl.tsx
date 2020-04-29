import React from 'react';

import SelectControl from 'app/components/forms/selectControl';

type SelectControlProps = React.ComponentProps<typeof SelectControl>;

type Props = Pick<
  SelectControlProps,
  'value' | 'placeholder' | 'name' | 'onChange' | 'options' | 'isDisabled'
>;

const DataPrivacyRulesPanelFormSelectControl = ({...props}: Props) => (
  <SelectControl
    {...props}
    isSearchable={false}
    styles={{
      control: (provided: {[x: string]: string | number | boolean}) => ({
        ...provided,
        minHeight: '34px',
        height: '34px',
      }),
    }}
    openOnFocus
    required
  />
);

export default DataPrivacyRulesPanelFormSelectControl;
