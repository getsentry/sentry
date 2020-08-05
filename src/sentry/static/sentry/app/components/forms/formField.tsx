import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';

import {defined} from 'app/utils';
import QuestionTooltip from 'app/components/questionTooltip';
import {Context} from 'app/components/forms/form';
import {Meta} from 'app/types';

type Value = string | number | boolean;

type FormFieldProps = {
  name: string;
  style?: object;
  label?: React.ReactNode;
  defaultValue?: any;
  disabled?: boolean;
  disabledReason?: string;
  help?: string | React.ReactNode;
  required?: boolean;
  hideErrorMessage?: boolean;
  className?: string;
  onChange?: (value: Value) => void;
  error?: string;
  value?: Value;
  meta?: Meta;
};

type FormFieldState = {
  error: string | null;
  value: Value;
};

export default class FormField<
  Props extends FormFieldProps = FormFieldProps,
  State extends FormFieldState = FormFieldState
> extends React.PureComponent<Props, State> {
  static propTypes = {
    name: PropTypes.string.isRequired,
    /** Inline style */
    style: PropTypes.object,

    label: PropTypes.node,

    // This is actually used but eslint doesn't parse it correctly
    // eslint-disable-next-line react/no-unused-prop-types
    defaultValue: PropTypes.any,

    disabled: PropTypes.bool,
    disabledReason: PropTypes.string,
    help: PropTypes.oneOfType([PropTypes.string, PropTypes.element]),
    required: PropTypes.bool,
    hideErrorMessage: PropTypes.bool,
    className: PropTypes.string,

    // the following should only be used without form context
    onChange: PropTypes.func,
    error: PropTypes.string, // eslint-disable-line react/no-unused-prop-types
    value: PropTypes.any,
    meta: PropTypes.any, // eslint-disable-line react/no-unused-prop-types
  };

  static contextTypes = {
    form: PropTypes.object,
  };

  static defaultProps = {
    hideErrorMessage: false,
    disabled: false,
    required: false,
  };

  constructor(props: Props, context: Context) {
    super(props, context);
    this.state = {
      error: null,
      value: this.getValue(props, context),
    } as State;
  }

  componentDidMount() {}

  UNSAFE_componentWillReceiveProps(nextProps: Props, nextContext: Context) {
    const newError = this.getError(nextProps, nextContext);
    if (newError !== this.state.error) {
      this.setState({error: newError});
    }
    if (this.props.value !== nextProps.value || defined(nextContext.form)) {
      const newValue = this.getValue(nextProps, nextContext);
      if (newValue !== this.state.value) {
        this.setValue(newValue);
      }
    }
  }

  componentWillUnmount() {}

  getValue(props: Props, context: Context) {
    const form = (context || this.context || {}).form;
    props = props || this.props;
    if (defined(props.value)) {
      return props.value;
    }
    if (form && form.data.hasOwnProperty(props.name)) {
      return defined(form.data[props.name]) ? form.data[props.name] : '';
    }
    return defined(props.defaultValue) ? props.defaultValue : '';
  }

  getError(props: Props, context: Context) {
    const form = (context || this.context || {}).form;
    props = props || this.props;
    if (defined(props.error)) {
      return props.error;
    }
    return (form && form.errors[props.name]) || null;
  }

  getId() {
    return `id-${this.props.name}`;
  }

  coerceValue(value: any) {
    return value;
  }

  onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    this.setValue(value);
  };

  setValue = (value: Value) => {
    const form = (this.context || {}).form;
    this.setState(
      {
        value,
      },
      () => {
        const finalValue = this.coerceValue(this.state.value);
        this.props.onChange && this.props.onChange(finalValue);
        form && form.onFieldChange(this.props.name, finalValue);
      }
    );
  };

  getField() {
    throw new Error('Must be implemented by child.');
  }

  getClassName(): string {
    throw new Error('Must be implemented by child.');
  }

  getFinalClassNames() {
    const {className, required} = this.props;
    const {error} = this.state;
    return classNames(className, this.getClassName(), {
      'has-error': !!error,
      required,
    });
  }

  renderDisabledReason() {
    const {disabled, disabledReason} = this.props;
    if (!disabled) {
      return null;
    }
    if (!disabledReason) {
      return null;
    }
    return <QuestionTooltip title={disabledReason} position="top" size="sm" />;
  }

  render() {
    const {label, hideErrorMessage, help, style} = this.props;
    const {error} = this.state;
    const cx = this.getFinalClassNames();
    const shouldShowErrorMessage = error && !hideErrorMessage;

    return (
      <div style={style} className={cx}>
        <div className="controls">
          {label && (
            <label htmlFor={this.getId()} className="control-label">
              {label}
            </label>
          )}
          {this.getField()}
          {this.renderDisabledReason()}
          {defined(help) && <p className="help-block">{help}</p>}
          {shouldShowErrorMessage && <ErrorMessage>{error}</ErrorMessage>}
        </div>
      </div>
    );
  }
}

const ErrorMessage = styled('p')`
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.red300};
`;
