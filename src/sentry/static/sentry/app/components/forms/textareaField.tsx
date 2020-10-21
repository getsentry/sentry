import InputField from 'app/components/forms/inputField';

type State = InputField['state'] & {
  value?: string;
};

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
