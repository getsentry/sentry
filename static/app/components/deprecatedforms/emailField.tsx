import InputField from 'sentry/components/forms/inputField';

export default class EmailField extends InputField {
  getType() {
    return 'email';
  }
}
