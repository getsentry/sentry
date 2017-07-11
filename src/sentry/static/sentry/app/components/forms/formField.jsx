import React from 'react';
import idx from 'idx';

import {defined} from '../../utils';

export default class FormField extends React.Component {
  static propTypes = {
    name: React.PropTypes.string.isRequired,

    label: React.PropTypes.string,
    defaultValue: React.PropTypes.any,
    disabled: React.PropTypes.bool,
    disabledReason: React.PropTypes.string,
    help: React.PropTypes.oneOfType([React.PropTypes.string, React.PropTypes.element]),
    required: React.PropTypes.bool,

    // the following should only be used without form context
    onChange: React.PropTypes.func,
    error: React.PropTypes.string,
    value: React.PropTypes.any
  };

  static defaultProps = {
    disabled: false,
    required: false
  };

  static contextTypes = {
    form: React.PropTypes.object
  };

  constructor(props, context) {
    super(props);

    this.state = {
      value: this.getValue(props, context)
    };
  }

  componentWillReceiveProps(nextProps, nextContext) {
    if (
      this.props.value !== nextProps.value ||
      (!defined(this.context.form) && defined(nextContext.form))
    ) {
      this.setState({value: this.getValue(nextProps, nextContext)});
    }
  }

  getValue(props, context) {
    let form = (context || this.context || {}).form;
    props = props || this.props;
    if (defined(props.value)) {
      return props.value;
    }
    if (form && form.data.hasOwnProperty(props.name)) {
      return form.data[props.name];
    }
    return props.defaultValue || '';
  }

  getError(props, context) {
    let form = (context || this.context || {}).form;
    props = props || this.props;
    if (defined(props.error)) {
      return props.error;
    }
    return idx(form, _ => _.errors[props.name]) || null;
  }

  getId() {
    return `id-${this.props.name}`;
  }

  coerceValue(value) {
    return value;
  }

  onChange = e => {
    let value = e.target.value;
    this.setValue(value);
  };

  setValue = value => {
    let form = (this.context || {}).form;
    this.setState(
      {
        value: value
      },
      () => {
        this.props.onChange && this.props.onChange(this.coerceValue(this.state.value));
        form && form.onFieldChange(this.props.name, this.coerceValue(this.state.value));
      }
    );
  };

  getField() {
    throw new Error('Must be implemented by child.');
  }

  render() {
    let className = this.getClassName();
    let error = this.getError();
    if (error) {
      className += ' has-error';
    }
    if (this.props.required) {
      className += ' required';
    }
    return (
      <div className={className}>
        <div className="controls">
          {this.props.label &&
            <label htmlFor={this.getId()} className="control-label">
              {this.props.label}
            </label>}
          {this.getField()}
          {this.props.disabled &&
            this.props.disabledReason &&
            <span className="disabled-indicator tip" title={this.props.disabledReason}>
              <span className="icon-question" />
            </span>}
          {defined(this.props.help) && <p className="help-block">{this.props.help}</p>}
          {error && <p className="error">{error}</p>}
        </div>
      </div>
    );
  }
}
