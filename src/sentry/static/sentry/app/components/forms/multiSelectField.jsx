import React from 'react';
import PropTypes from 'prop-types';

import FormField from 'app/components/forms/formField';
import StyledSelect from 'app/components/forms/select.styled';

export default class MultiSelectField extends FormField {
  static propTypes = {
    options: PropTypes.array.isRequired,
    onChange: PropTypes.func,
    value: PropTypes.any,
  };

  constructor(props) {
    super(props);
    this.state = {
      value: [],
    };
  }

  getClassName() {
    return '';
  }

  onChange = (opts = []) => {
    const value = opts.map(opt => opt.value);
    this.setValue(value);
  };

  renderArrow = () => {
    return <span className="icon-arrow-down" />;
  };

  getField() {
    return (
      <StyledSelect
        id={this.getId()}
        onChange={this.onChange}
        value={this.state.value}
        multi={true}
        arrowRenderer={this.renderArrow}
        style={{width: 200, overflow: 'visible'}}
        {...this.props}
      />
    );
  }
}
