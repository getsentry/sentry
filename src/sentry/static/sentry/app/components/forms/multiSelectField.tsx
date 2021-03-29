import SelectField from 'app/components/forms/selectField';

export default class MultiSelectField extends SelectField {
  isMultiple() {
    return true;
  }
}
