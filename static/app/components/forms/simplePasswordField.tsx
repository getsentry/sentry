import InputField from 'app/components/forms/inputField';

export default class SimplePasswordField extends InputField {
  getType() {
    return 'password';
  }
}
