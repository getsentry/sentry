import type {ComponentProps} from 'react';
import styled from '@emotion/styled';

import SelectField from 'sentry/components/forms/fields/selectField';

type SelectFieldProps = ComponentProps<typeof SelectField>;

export default function AutomationBuilderSelectField(props: SelectFieldProps) {
  return (
    <StyledSelectField
      flexibleControlStateSize
      hideLabel
      inline
      styles={selectControlStyles}
      {...props}
    />
  );
}

const StyledSelectField = styled(SelectField)`
  width: 180px;
  padding: 0;
  > div {
    padding-left: 0;
  }
`;

const selectControlStyles = {
  control: (provided: any) => ({
    ...provided,
    minHeight: '28px',
    height: '28px',
    padding: 0,
  }),
};
