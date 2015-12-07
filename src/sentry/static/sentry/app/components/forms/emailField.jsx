import InputField from './inputField';

export default class EmailField extends InputField {
  getType() {
    return 'email';
  }
}
