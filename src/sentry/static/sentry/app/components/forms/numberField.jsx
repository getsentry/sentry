import InputField from './inputField';

export default class NumberField extends InputField {
  getType() {
    return 'number';
  }

  getAttributes() {
    return {
      min: this.props.min || undefined,
      max: this.props.max || undefined
    };
  }
}
