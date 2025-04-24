import type {ComponentProps} from 'react';
import styled from '@emotion/styled';

import InputField from 'sentry/components/forms/fields/inputField';

type InputFieldProps = ComponentProps<typeof InputField>;

export default function InlineInputField(props: InputFieldProps) {
  return <StyledInputField style={{height: '28px', minHeight: '28px'}} {...props} />;
}

const StyledInputField = styled(InputField)`
  padding: 0;
  width: 180px;
  height: 28px;
  min-height: 28px;
  > div {
    padding-left: 0;
  }
`;
