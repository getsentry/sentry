import {InputField} from 'sentry/components/deprecatedforms/inputField';
import {withFormContext} from 'sentry/components/deprecatedforms/withFormContext';

type Props = InputField['props'] & {
  spellCheck?: string;
};

// XXX: This is ONLY used in GenericField. If we can delete that this can go.

/**
 * @deprecated Do not use this
 */
// Will be fixed by https://github.com/typescript-eslint/typescript-eslint/pull/12206
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-arguments
class TextField extends InputField<Props> {
  getAttributes() {
    return {
      spellCheck: this.props.spellCheck,
    };
  }

  getType() {
    return 'text';
  }
}

/**
 * @deprecated Do not use this
 */
export default withFormContext(TextField);
