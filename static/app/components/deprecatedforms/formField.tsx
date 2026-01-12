import {PureComponent} from 'react';
import styled from '@emotion/styled';
import classNames from 'classnames';

import type {FormContextData} from 'sentry/components/deprecatedforms/formContext';
import QuestionTooltip from 'sentry/components/questionTooltip';
import type {Meta} from 'sentry/types/group';
import {defined} from 'sentry/utils';

type Value = string | number | boolean;

type DefaultProps = {
  disabled?: boolean;
  hideErrorMessage?: boolean;
  required?: boolean;
};

export type FormFieldProps = DefaultProps & {
  formContext: FormContextData;
  name: string;
  className?: string;
  defaultValue?: any;
  disabledReason?: string;
  error?: string;
  help?: string | React.ReactNode;
  id?: string;
  label?: React.ReactNode;
  meta?: Meta;
  onChange?: (value: Value) => void;
  style?: Record<PropertyKey, unknown>;
  value?: Value;
};

type FormFieldState = {
  error: string | null;
  value: Value;
};

export default abstract class FormField<
  Props extends FormFieldProps = FormFieldProps,
  State extends FormFieldState = FormFieldState,
> extends PureComponent<Props, State> {
  static defaultProps: DefaultProps = {
    hideErrorMessage: false,
    disabled: false,
    required: false,
  };

  constructor(props: Props) {
    super(props);
    this.state = {
      error: null,
      value: this.getValue(props),
    } as State;
  }

  UNSAFE_componentWillReceiveProps(nextProps: Props) {
    const newError = this.getError(nextProps);
    if (newError !== this.state.error) {
      this.setState({error: newError});
    }
    if (this.props.value !== nextProps.value || defined(nextProps.formContext.form)) {
      const newValue = this.getValue(nextProps);
      if (newValue !== this.state.value) {
        this.setValue(newValue);
      }
    }
  }

  getValue(props: Props) {
    const form = (props.formContext || this.props.formContext)?.form;
    props = props || this.props;
    if (defined(props.value)) {
      return props.value;
    }
    if (form?.data.hasOwnProperty(props.name)) {
      return defined(form.data[props.name]) ? form.data[props.name] : '';
    }
    return defined(props.defaultValue) ? props.defaultValue : '';
  }

  getError(props: Props) {
    const form = (props.formContext || this.props.formContext)?.form;
    props = props || this.props;
    if (defined(props.error)) {
      return props.error;
    }
    return form?.errors[props.name] || null;
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
    const form = this.props.formContext?.form;
    this.setState(
      {
        value,
      },
      () => {
        const finalValue = this.coerceValue(this.state.value);
        this.props.onChange?.(finalValue);
        form?.onFieldChange(this.props.name, finalValue);
      }
    );
  };

  abstract getField(): React.ReactNode;
  abstract getClassName(): string;

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
  font-size: ${p => p.theme.fontSize.md};
  color: ${p => p.theme.tokens.content.danger};
`;
