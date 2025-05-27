import type {ComponentProps} from 'react';
import styled from '@emotion/styled';

import InputField from 'sentry/components/forms/fields/inputField';

type InputFieldProps = ComponentProps<typeof InputField>;

export default function AutomationBuilderInputField(props: InputFieldProps) {
  return (
    <StyledInputField
      flexibleControlStateSize
      hideLabel
      inline
      style={{height: '32px', minHeight: '32px'}}
      {...props}
    />
  );
}

const StyledInputField = styled(InputField)`
  padding: 0;
  width: 180px;
  border: none;
  > div {
    padding-left: 0;
  }
`;
