import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';
import idx from 'idx';

import {defined} from '../../utils';

export default class FormField extends React.PureComponent {
  static propTypes = {
    name: PropTypes.string.isRequired,
    /** Inline style */
    style: PropTypes.object,

    label: PropTypes.string,
    defaultValue: PropTypes.any,
    disabled: PropTypes.bool,
    disabledReason: PropTypes.string,
    help: PropTypes.oneOfType([PropTypes.string, PropTypes.element]),
    required: PropTypes.bool,
    hideErrorMessage: PropTypes.bool,

    // the following should only be used without form context
    onChange: PropTypes.func,
    error: PropTypes.string,
    value: PropTypes.any
  };

  static defaultProps = {
    hideErrorMessage: false,
    disabled: false,
    required: false
  };

  static contextTypes = {
    form: PropTypes.object
  };

  constructor(props, context) {
    super(props, context);
    this.state = {
      value: this.getValue(props, context)
    };
  }

  componentDidMount() {}

  componentWillReceiveProps(nextProps, nextContext) {
    if (
      this.props.value !== nextProps.value ||
      (!defined(this.context.form) && defined(nextContext.form))
    ) {
      this.setValue(this.getValue(nextProps, nextContext));
    }
  }

  componentWillUnmount() {}

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
        value
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
    let {
      className,
      required,
      label,
      disabled,
      disabledReason,
      hideErrorMessage,
      help,
      style
    } = this.props;
    let error = this.getError();
    let cx = classNames(className, this.getClassName(), {
      'has-error': !!error,
      required
    });
    let shouldShowErrorMessage = error && !hideErrorMessage;

    return (
      <div style={style} className={cx}>
        <div className="controls">
          {label &&
            <label htmlFor={this.getId()} className="control-label">
              {label}
            </label>}
          {this.getField()}
          {disabled &&
            disabledReason &&
            <span className="disabled-indicator tip" title={disabledReason}>
              <span className="icon-question" />
            </span>}
          {defined(help) && <p className="help-block">{help}</p>}
          {shouldShowErrorMessage && <p className="error">{error}</p>}
        </div>
      </div>
    );
  }
}
