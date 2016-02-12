import React from 'react';

class FormField extends React.Component {
  constructor(props) {
    super(props);
    this.state = {};
  }
}

FormField.defaultProps = {
  onChange: (value) => {},
};

export default FormField;
