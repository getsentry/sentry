import React from 'react';

import {t} from '../../locale';

const Form = React.createClass({
  getDefaultProps() {
    return {
      submitLabel: t('Save Changes'),
      submitDisabled: false,
    };
  },

  onSubmit(e) {
    e.preventDefault();
    this.props.onSubmit();
  },

  render() {
    return (
      <form onSubmit={this.onSubmit}>
        {this.props.children}
        <div className="form-actions" style={{marginTop: 25}}>
          <button className="btn btn-primary"
                  disabled={this.props.submitDisabled}
                  type="submit">{this.props.submitLabel}</button>
        </div>
      </form>
    );
  }
});

export default Form;
