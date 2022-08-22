import InputField from 'sentry/components/deprecatedforms/inputField';

export default class DateTimeField extends InputField {
  getType() {
    return 'datetime-local';
  }
}
