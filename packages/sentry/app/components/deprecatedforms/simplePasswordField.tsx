import InputField from 'sentry/components/deprecatedforms/inputField';

export default class SimplePasswordField extends InputField {
  getType() {
    return 'password';
  }
}
