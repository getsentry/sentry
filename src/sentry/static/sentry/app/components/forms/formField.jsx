import React from 'react';

class FormField extends React.Component {
  constructor(props) {
    super(props);
    this.state = {};
  }
}

FormField.propTypes = {
  name: React.PropTypes.string.isRequired,

  label: React.PropTypes.string,
  defaultValue: React.PropTypes.any,
  disabled: React.PropTypes.bool,
  error: React.PropTypes.string,
  help: React.PropTypes.oneOfType([
    React.PropTypes.string,
    React.PropTypes.element,
  ]),
  onChange: React.PropTypes.func,
  required: React.PropTypes.bool,
  value: React.PropTypes.any,
};

FormField.defaultProps = {
  disabled: false,
  onChange: (value) => {},
  required: false,
};

export default FormField;
