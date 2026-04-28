import type {InputFieldProps} from './inputField';
import {InputField} from './inputField';

export type DateTimeFieldProps = Omit<InputFieldProps, 'type'>;

export function DateTimeField(props: DateTimeFieldProps) {
  return <InputField {...props} type="datetime-local" />;
}
