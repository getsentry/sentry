import SelectField from 'sentry/components/deprecatedforms/selectField';

export default class MultiSelectField extends SelectField {
  isMultiple() {
    return true;
  }
}
