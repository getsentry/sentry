import React from 'react';
import styled from '@emotion/styled';

import InputField from './inputField';

type Props = Omit<InputField['props'], 'type'>;

export default function HiddenField(props: Props) {
  return <HiddenInputField {...props} type="hidden" />;
}

const HiddenInputField = styled(InputField)`
  display: none;
`;
