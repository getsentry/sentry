import InputField from 'sentry/components/deprecatedforms/inputField';

// XXX: This is ONLY used in GenericField. If we can delete that this can go.

/**
 * @deprecated Do not use this
 */
export default class EmailField extends InputField {
  getType() {
    return 'email';
  }
}
