import type {InputFieldProps} from './inputField';
import {InputField} from './inputField';

export interface TextFieldProps extends Omit<InputFieldProps, 'type'> {}

export function TextField(props: TextFieldProps) {
  return <InputField {...props} type="text" />;
}
