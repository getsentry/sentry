import SelectField from 'sentry/components/forms/selectField';

export default class MultiSelectField extends SelectField {
  isMultiple() {
    return true;
  }
}
