import React from 'react';
import PropTypes from 'prop-types';
import Select from 'react-select';
import styled from 'react-emotion';

import InputField from './inputField';

export default class MultiSelectField extends InputField {
  static propTypes = {
    options: PropTypes.array.isRequired,
    onChange: PropTypes.func,
    value: PropTypes.any,
  };

  constructor(props) {
    super(props);
    this.state = {
      values: [],
    };
  }

  handleChange = value => {
    this.setState({values: value}, () => {
      if (typeof this.props.onChange === 'function') {
        this.props.onChange(value);
      }
    });
  };

  renderArrow = () => {
    return <span className="icon-arrow-down" />;
  };

  render() {
    return (
      <MultiSelect
        id={this.getId()}
        onChange={this.handleChange}
        value={this.state.values}
        multi={true}
        arrowRenderer={this.renderArrow}
        style={{width: 200, zIndex: 100, overflow: 'visible'}}
        {...this.props}
      />
    );
  }
}

const MultiSelect = styled(Select)`
  font-size: 15px;
  .Select-control {
    overflow: visible;
  }
  .Select-input {
    height: 37px;
    input {
      padding: 10px 0;
    }
  }

  .Select-placeholder,
  .Select--single > .Select-control .Select-value {
    height: 37px;
    &:focus {
      border: 1px solid ${p => p.theme.gray};
    }
  }

  .Select-option.is-focused {
    color: white;
    background-color: ${p => p.theme.purple};
  }
  .Select-multi-value-wrapper {
    > a {
      margin-left: 4px;
    }
  }
`;
