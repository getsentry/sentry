import React from 'react';
import PropTypes from 'prop-types';

import FormField from 'app/components/forms/formField';
import StyledSelect from 'app/components/forms/select.styled';

export default class MultiSelectField extends FormField {
  static propTypes = {
    options: PropTypes.array,
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
        style={{width: 200, overflow: 'visible'}}
        value={this.state.values}
        id={this.getId()}
        multi={true}
        arrowRenderer={this.renderArrow}
        {...this.props}
        onChange={this.handleChange}
      />
    );
  }
}
