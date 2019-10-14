import InputField from 'app/components/forms/inputField';

export default class EmailField extends InputField {
  getType() {
    return 'email';
  }
}
