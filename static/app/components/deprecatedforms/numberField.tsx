import InputField from 'sentry/components/deprecatedforms/inputField';

type Props = {
  max?: number;
  min?: number;
} & InputField['props'];

export default class NumberField extends InputField<Props> {
  coerceValue(value) {
    const intValue = parseInt(value, 10);

    // return previous value if new value is NaN, otherwise, will get recursive error
    const isNewCoercedNaN = isNaN(intValue);

    if (!isNewCoercedNaN) {
      return intValue;
    }

    return '';
  }

  getType() {
    return 'number';
  }

  getAttributes() {
    return {
      min: this.props.min || undefined,
      max: this.props.max || undefined,
    };
  }
}
