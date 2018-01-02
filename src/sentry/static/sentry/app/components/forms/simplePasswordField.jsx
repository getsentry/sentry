import InputField from './inputField';

export default class SimplePasswordField extends InputField {
  getType() {
    return 'password';
  }
}
