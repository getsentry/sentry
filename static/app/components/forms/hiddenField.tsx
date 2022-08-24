import styled from '@emotion/styled';

import type {InputFieldProps} from './inputField';
import InputField from './inputField';

export interface HiddenFieldProps extends Omit<InputFieldProps, 'type'> {}

export default function HiddenField(props: HiddenFieldProps) {
  return <HiddenInputField {...props} type="hidden" />;
}

const HiddenInputField = styled(InputField)`
  display: none;
`;
