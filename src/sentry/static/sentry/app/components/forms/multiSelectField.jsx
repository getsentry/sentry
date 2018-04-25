import React from 'react';
import PropTypes from 'prop-types';
import AsyncSelect from 'react-select/lib/Async';
import styled from 'react-emotion';

import FormField from 'app/components/forms/formField';
import StyledSelect from 'app/components/forms/select.styled';

export default class MultiSelectField extends FormField {
  static propTypes = {
    async: PropTypes.bool,
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
      <MultiSelect
        style={{width: 200, overflow: 'visible'}}
        value={this.state.values}
        {...this.props}
        id={this.getId()}
        onChange={this.handleChange}
        multi={true}
        arrowRenderer={this.renderArrow}
      />
    );
  }
}

const MultiSelect = styled(({async, ...props}) => {
  if (async) {
    return <AsyncSelect {...props} />;
  }
  return <StyledSelect {...props} />;
});
