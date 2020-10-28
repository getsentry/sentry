import InputField from 'app/components/forms/inputField';

export default class DateTimeField extends InputField {
  getType() {
    return 'datetime-local';
  }
}
