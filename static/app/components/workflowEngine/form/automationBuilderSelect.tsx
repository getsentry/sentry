import type {ComponentProps} from 'react';
import styled from '@emotion/styled';

import {Select} from 'sentry/components/core/select';

export function AutomationBuilderSelect(props: ComponentProps<typeof Select>) {
  return (
    <StyledSelect
      flexibleControlStateSize
      hideLabel
      inline
      styles={selectControlStyles}
      {...props}
    />
  );
}

const StyledSelect = styled(Select)`
  width: 180px;
  padding: 0;
  > div {
    padding-left: 0;
  }
  border: none;
`;

export const selectControlStyles = {
  control: (provided: any) => ({
    ...provided,
    minHeight: '32px',
    height: '32px',
    padding: 0,
  }),
};
