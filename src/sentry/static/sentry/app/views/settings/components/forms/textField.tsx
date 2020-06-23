import React from 'react';

import InputField from 'app/views/settings/components/forms/inputField';

type Props = InputField['props'];

export default function TextField(props: Props) {
  return <InputField {...props} type="text" />;
}

TextField.propTypes = {...InputField.propTypes};
