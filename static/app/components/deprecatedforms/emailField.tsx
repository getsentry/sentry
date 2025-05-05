import InputField from 'sentry/components/deprecatedforms/inputField';
import withFormContext from 'sentry/components/deprecatedforms/withFormContext';

// XXX: This is ONLY used in GenericField. If we can delete that this can go.

/**
 * @deprecated Do not use this
 */
class EmailField extends InputField {
  getType() {
    return 'email';
  }
}

/**
 * @deprecated Do not use this
 */
export default withFormContext(EmailField);
