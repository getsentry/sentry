import styled from '@emotion/styled';

import InputField, {InputFieldProps} from './inputField';

export default function HiddenField(props: Omit<InputFieldProps<{}>, 'type'>) {
  return <HiddenInputField {...props} type="hidden" />;
}

const HiddenInputField = styled(InputField)`
  display: none;
`;
