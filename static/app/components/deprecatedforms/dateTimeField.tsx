import InputField from 'sentry/components/deprecatedforms/inputField';

/**
 * @deprecated Do not use this
 */
export class DateTimeField extends InputField {
  getType() {
    return 'datetime-local';
  }
}
