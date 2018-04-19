import InputField from './inputField';

export default class DateTimeField extends InputField {
  getType() {
    return 'datetime-local';
  }
}
