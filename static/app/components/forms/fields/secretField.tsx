import InputField, {InputFieldProps} from './inputField';

export interface SecretFieldProps extends Omit<InputFieldProps, 'type'> {}

function SecretField(props: SecretFieldProps) {
  // XXX: We explicitly give the password field a aria textbox role. This field
  // does not typically have a role, but for testability reasons it's preferred
  // for it to have a role. See [0]
  //
  // [0]: https://github.com/testing-library/dom-testing-library/issues/567
  return <InputField {...props} type="password" role="textbox" />;
}

export default SecretField;
