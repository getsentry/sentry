import React from 'react';

import InputField from './inputField';

type Props = InputField['props'];

export default function DateTimeField(props: Props) {
  return <InputField {...props} type="datetime-local" />;
}
