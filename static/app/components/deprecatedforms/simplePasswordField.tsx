import InputField from 'sentry/components/forms/inputField';

export default class SimplePasswordField extends InputField {
  getType() {
    return 'password';
  }
}
