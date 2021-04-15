import React from 'react';

import InputField from './inputField';

type Props = InputField['props'];

export default function EmailField(props: Omit<Props, 'type'>) {
  return <InputField {...props} type="email" />;
}
