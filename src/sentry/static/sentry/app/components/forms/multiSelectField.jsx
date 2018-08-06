import PropTypes from 'prop-types';

import SelectField from 'app/components/forms/selectField';

export default class MultiSelectField extends SelectField {
  static propTypes = {
    options: PropTypes.array,
    onChange: PropTypes.func,
    value: PropTypes.any,
  };

  isMultiple() {
    return true;
  }
}
