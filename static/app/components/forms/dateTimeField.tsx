import InputField from 'sentry/components/forms/inputField';

export default class DateTimeField extends InputField {
  getType() {
    return 'datetime-local';
  }
}
