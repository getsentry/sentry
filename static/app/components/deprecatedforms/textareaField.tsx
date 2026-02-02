import {TextArea} from '@sentry/scraps/textarea';

import InputField from 'sentry/components/deprecatedforms/inputField';
import withFormContext from 'sentry/components/deprecatedforms/withFormContext';

type State = InputField['state'] & {
  value?: string;
};

// XXX: This is ONLY used in GenericField. If we can delete that this can go.

/**
 * @deprecated Do not use this
 */
class TextareaField extends InputField<InputField['props'], State> {
  getField() {
    return (
      <TextArea
        id={this.getId()}
        className="form-control"
        value={this.state.value}
        disabled={this.props.disabled}
        required={this.props.required}
        placeholder={this.props.placeholder}
        onChange={this.onChange.bind(this)}
      />
    );
  }

  /**
   * Unused, only defined to satisfy abstract class
   */
  getType() {
    return '';
  }
}

/**
 * @deprecated Do not use this
 */
export default withFormContext(TextareaField);
