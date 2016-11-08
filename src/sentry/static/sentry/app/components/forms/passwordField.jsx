import React from 'react';
import InputField from './inputField';

class PasswordField extends InputField {
  constructor(props) {
    super(props);

    this.startEdit = this.startEdit.bind(this);
    this.cancelEdit = this.cancelEdit.bind(this);

    this.state.editing = false;
  }

  getType() {
    return 'password';
  }

  cancelEdit(ev) {
    ev.preventDefault();
    this.setState({
      value: '',
      editing: false
    }, () => {
      this.props.onChange('');
    });
  }

  startEdit(ev) {
    ev.preventDefault();
    this.setState({
      editing: true
    });
  }

  getField() {
    if (!this.props.has_saved_value) {
      return super.getField();
    }

    if (this.state.editing) {
      return (
        <div className="row">
          <div className="col-md-10">
            {super.getField()}
          </div>
          <div className="col-md-2" style={{lineHeight: '37px'}}>
            <a href="#" onClick={this.cancelEdit}>Cancel</a>
          </div>
        </div>
      );
    } else {
      return (
        <div>
          <span>{this.props.prefix + '********************'}</span>
          {!this.props.disabled &&
            <a href="#" style={{marginLeft: '10px'}}
               onClick={this.startEdit}>Edit</a>}
        </div>
      );
    }
  }
}

PasswordField.defaultProps = Object.assign({}, InputField.defaultProps, {
  'has_saved_value': false,
  'prefix': ''
});

export default PasswordField;
