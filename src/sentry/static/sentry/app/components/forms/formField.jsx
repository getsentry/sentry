import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {defined} from '../../utils';
import InlineSvg from '../inlineSvg';

const StyledInlineSvg = styled(InlineSvg)`
  display: block;
  color: ${p => p.theme.gray3};
`;

export default class FormField extends React.PureComponent {
  static propTypes = {
    name: PropTypes.string.isRequired,
    /** Inline style */
    style: PropTypes.object,

    label: PropTypes.string,

    // This is actually used but eslint doesn't parse it correctly
    // eslint-disable-next-line react/no-unused-prop-types
    defaultValue: PropTypes.any,

    disabled: PropTypes.bool,
    disabledReason: PropTypes.string,
    help: PropTypes.oneOfType([PropTypes.string, PropTypes.element]),
    required: PropTypes.bool,
    hideErrorMessage: PropTypes.bool,

    // the following should only be used without form context
    onChange: PropTypes.func,
    error: PropTypes.string,
    value: PropTypes.any,
  };

  static defaultProps = {
    hideErrorMessage: false,
    disabled: false,
    required: false,
  };

  static contextTypes = {
    form: PropTypes.object,
  };

  constructor(props, context) {
    super(props, context);
    this.state = {
      error: null,
      value: this.getValue(props, context),
    };
  }

  componentDidMount() {}

  componentWillReceiveProps(nextProps, nextContext) {
    let newError = this.getError(nextProps, nextContext);
    if (newError != this.state.error) {
      this.setState({error: newError});
    }
    if (this.props.value !== nextProps.value || defined(nextContext.form)) {
      let newValue = this.getValue(nextProps, nextContext);
      if (newValue !== this.state.value) {
        this.setValue(newValue);
      }
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
      return defined(form.data[props.name]) ? form.data[props.name] : '';
    }
    return defined(props.defaultValue) ? props.defaultValue : '';
  }

  getError(props, context) {
    let form = (context || this.context || {}).form;
    props = props || this.props;
    if (defined(props.error)) {
      return props.error;
    }
    return form?.errors?.[props.name] || null;
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
        value,
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
      style,
    } = this.props;
    let {error} = this.state;
    let cx = classNames(className, this.getClassName(), {
      'has-error': !!error,
      required,
    });
    let shouldShowErrorMessage = error && !hideErrorMessage;

    return (
      <div style={style} className={cx}>
        <div className="controls">
          {label && (
            <label htmlFor={this.getId()} className="control-label">
              {label}
            </label>
          )}
          {this.getField()}
          {disabled &&
            disabledReason && (
              <span className="disabled-indicator tip" title={disabledReason}>
                <StyledInlineSvg src="icon-circle-question" size="18px" />
              </span>
            )}
          {defined(help) && <p className="help-block">{help}</p>}
          {shouldShowErrorMessage && <p className="error">{error}</p>}
        </div>
      </div>
    );
  }
}
