import InputField from 'sentry/components/deprecatedforms/inputField';

type State = InputField['state'] & {
  value?: string;
};

// XXX: This is ONLY used in GenericField. If we can delete that this can go.

/**
 * @deprecated Do not use this
 */
export default class TextareaField extends InputField<InputField['props'], State> {
  getField() {
    return (
      <textarea
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
}
