import React from 'react';
import PropTypes from 'prop-types';

import {defined} from 'app/utils';
import FormField from 'app/components/forms/formField';
import MultiSelectControl from 'app/components/forms/multiSelectControl';

export default class MultiSelectField extends FormField {
  static propTypes = {
    options: PropTypes.array,
    onChange: PropTypes.func,
    value: PropTypes.any,
  };

  // Overriding this for now so that we can set default value to `[]`
  getValue(props, context) {
    let form = (context || this.context || {}).form;
    props = props || this.props;
    if (defined(props.value)) {
      return props.value;
    }
    if (form && form.data.hasOwnProperty(props.name)) {
      return defined(form.data[props.name]) ? form.data[props.name] : [];
    }
    return defined(props.defaultValue) ? props.defaultValue : [];
  }

  getClassName() {
    return '';
  }

  onChange = (opts = []) => {
    const value = opts.map(opt => opt.value);
    this.setValue(value);
  };

  getField() {
    return (
      <MultiSelectControl
        id={this.getId()}
        value={this.state.value}
        {...this.props}
        onChange={this.onChange}
      />
    );
  }
}
