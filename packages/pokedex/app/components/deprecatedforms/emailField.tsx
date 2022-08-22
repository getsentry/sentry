import InputField from 'sentry/components/deprecatedforms/inputField';

export default class EmailField extends InputField {
  getType() {
    return 'email';
  }
}
