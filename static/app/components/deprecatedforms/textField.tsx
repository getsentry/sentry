import InputField from 'sentry/components/deprecatedforms/inputField';

type Props = InputField['props'] & {
  spellCheck?: string;
};

// XXX: This is ONLY used in GenericField. If we can delete that this can go.

/**
 * @deprecated Do not use this
 */
export default class TextField extends InputField<Props> {
  getAttributes() {
    return {
      spellCheck: this.props.spellCheck,
    };
  }

  getType() {
    return 'text';
  }
}
