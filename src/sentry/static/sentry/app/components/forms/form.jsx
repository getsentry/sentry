import React from 'react';

import FormState from './state';
import {t} from '../../locale';

class Form extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      formData: Object.assign({}, this.props.initialData),
      errors: {}
    };
    ['onSubmit', 'onFieldChange'].forEach(f => {
      this[f] = this[f].bind(this);
    });
  }

  onSubmit(e) {
    e.preventDefault();
    this.props.onSubmit && this.props.onSubmit(this.state.formData);
  }

  onFieldChange(name, value) {
    let formData = this.state.formData;
    formData[name] = value;
    this.setState({
      formData: formData
    });
  }

  render() {
    let isSaving = this.state.state === FormState.SAVING;
    let {formData, errors} = this.state;
    return (
      <form onSubmit={this.onSubmit} className={this.props.className}>
        {this.state.state === FormState.ERROR &&
          <div className="alert alert-error alert-block">
            {t(
              'Unable to save your changes. Please ensure all fields are valid and try again.'
            )}
          </div>}
        <fieldset>
          {(this.props.fields || []).map(config => {
            return (
              <config.component
                key={`field_${config.name}`}
                {...config}
                value={formData[config.name]}
                error={errors[config.name]}
                onChange={this.onFieldChange.bind(this, config.name)}
              />
            );
          })}
        </fieldset>
        {this.props.children}
        <div className={this.props.footerClass} style={{marginTop: 25}}>
          <button
            className="btn btn-primary"
            disabled={isSaving || this.props.submitDisabled}
            type="submit">
            {this.props.submitLabel}
          </button>
          {this.props.extraButton}
        </div>
      </form>
    );
  }
}

Form.propTypes = {
  onSubmit: React.PropTypes.func.isRequired,
  submitDisabled: React.PropTypes.bool,
  submitLabel: React.PropTypes.string.isRequired,
  footerClass: React.PropTypes.string,
  extraButton: React.PropTypes.element,
  initialData: React.PropTypes.object,
  fields: React.PropTypes.arrayOf(
    React.PropTypes.shape({
      // this is a function, as its a React definition,
      // and not an instance of an element
      component: React.PropTypes.func.isRequired,
      name: React.PropTypes.string.isRequired,
      label: React.PropTypes.string.isRequired
    })
  )
};

Form.defaultProps = {
  submitLabel: t('Save Changes'),
  submitDisabled: false,
  footerClass: 'form-actions align-right',
  className: 'form-stacked'
};

export default Form;
