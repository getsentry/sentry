import PropTypes from 'prop-types';
import React from 'react';

import InputField from 'app/views/settings/components/forms/inputField';
import FormState from 'app/components/forms/state';

// TODO(dcramer): im not entirely sure this is working correctly with
// value propagation in all scenarios
export default class PasswordField extends InputField {
  static propTypes = {
    ...InputField.propTypes,
    hasSavedValue: PropTypes.bool,
    prefix: PropTypes.string,
  };

  static defaultProps = {
    ...InputField.defaultProps,
    hasSavedValue: false,
    prefix: '',
  };

  constructor(props, context) {
    super(props, context);

    this.state.editing = false;
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    // close edit mode after successful save
    // TODO(dcramer): this needs to work with this.context.form
    if (
      this.props.formState &&
      this.props.formState === FormState.SAVING &&
      nextProps.formState === FormState.READY
    ) {
      this.setState({
        editing: false,
      });
    }
  }

  getType() {
    return 'password';
  }

  cancelEdit = e => {
    e.preventDefault();
    this.setState(
      {
        editing: false,
      },
      () => {
        this.setValue('');
      }
    );
  };

  startEdit = e => {
    e.preventDefault();
    this.setState({
      editing: true,
    });
  };

  getField() {
    if (!this.props.hasSavedValue) {
      return super.getField();
    }

    if (this.state.editing) {
      return (
        <div className="form-password editing">
          <div>{super.getField()}</div>
          <div>
            <a onClick={this.cancelEdit}>Cancel</a>
          </div>
        </div>
      );
    } else {
      return (
        <div className="form-password saved">
          <span>
            {this.props.prefix + new Array(21 - this.props.prefix.length).join('*')}
          </span>
          {!this.props.disabled && <a onClick={this.startEdit}>Edit</a>}
        </div>
      );
    }
  }
}
