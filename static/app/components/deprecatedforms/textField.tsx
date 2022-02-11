import InputField from 'sentry/components/deprecatedforms/inputField';

type Props = InputField['props'] & {
  spellCheck?: string;
};

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
