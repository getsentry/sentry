import React from 'react';

import InputField from './inputField';

type Props = InputField['props'];

export default function EmailField(props: Props) {
  return <InputField {...props} type="email" />;
}
