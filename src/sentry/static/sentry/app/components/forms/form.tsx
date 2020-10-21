import PropTypes from 'prop-types';
import * as React from 'react';
import isEqual from 'lodash/isEqual';
import styled from '@emotion/styled';

import FormState from 'app/components/forms/state';
import {t} from 'app/locale';

type FormProps = {
  cancelLabel?: string;
  onCancel?: () => void;
  onSubmit?: (
    data: object,
    onSubmitSuccess?: (data: object) => void,
    onSubmitError?: (error: object) => void
  ) => void;
  initialData?: object;
  onSubmitSuccess?: (data: object) => void;
  onSubmitError?: (error: object) => void;
  resetOnError?: boolean;
  requireChanges?: boolean;
  errorMessage?: React.ReactNode;
  hideErrors?: boolean;
  className?: string;
  footerClass?: string;
  submitDisabled?: boolean;
  submitLabel?: string;
  extraButton?: React.ReactNode;
};

type FormState = {
  data: any;
  errors: {non_field_errors?: object[]} & object;
  initialData: object;
  state: typeof FormState[keyof typeof FormState];
};

export type Context = {
  form: {
    errors: object;
    data: object;
    onFieldChange: (name: string, value: string | number) => void;
  };
};

class Form<
  Props extends FormProps = FormProps,
  State extends FormState = FormState
> extends React.Component<Props, State> {
  static propTypes = {
    cancelLabel: PropTypes.string,
    onCancel: PropTypes.func,
    onSubmit: PropTypes.func, //actually required but we cannot make it required because it's optional in apiForm
    onSubmitSuccess: PropTypes.func,
    onSubmitError: PropTypes.func,
    submitDisabled: PropTypes.bool,
    submitLabel: PropTypes.string,
    footerClass: PropTypes.string,
    extraButton: PropTypes.element,
    initialData: PropTypes.object,
    requireChanges: PropTypes.bool,
    errorMessage: PropTypes.node,
    hideErrors: PropTypes.bool,
    resetOnError: PropTypes.bool,
  };

  static childContextTypes = {
    form: PropTypes.object.isRequired,
  };

  static defaultProps = {
    cancelLabel: t('Cancel'),
    submitLabel: t('Save Changes'),
    submitDisabled: false,
    footerClass: 'form-actions align-right',
    className: 'form-stacked',
    requireChanges: false,
    hideErrors: false,
    resetOnError: false,
    errorMessage: t(
      'Unable to save your changes. Please ensure all fields are valid and try again.'
    ),
  };

  constructor(props: Props, context: Context) {
    super(props, context);
    this.state = {
      data: {...this.props.initialData},
      errors: {},
      initialData: {...this.props.initialData},
      state: FormState.READY,
    } as State;
  }

  getChildContext() {
    const {data, errors} = this.state;
    return {
      form: {
        data,
        errors,
        onFieldChange: this.onFieldChange,
      },
    };
  }

  onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!this.props.onSubmit) {
      throw new Error('onSubmit is a required prop');
    }
    this.props.onSubmit(this.state.data, this.onSubmitSuccess, this.onSubmitError);
  };

  onSubmitSuccess = (data: object) => {
    const curData = this.state.data;
    let newData = {};
    if (data) {
      Object.keys(curData).forEach(k => {
        if (data.hasOwnProperty(k)) {
          newData[k] = data[k];
        } else {
          newData[k] = curData[k];
        }
      });
    } else {
      newData = curData;
    }

    this.setState({
      state: FormState.READY,
      errors: {},
      initialData: newData,
    });
    this.props.onSubmitSuccess && this.props.onSubmitSuccess(data);
  };

  onSubmitError = error => {
    this.setState({
      state: FormState.ERROR,
      errors: error.responseJSON,
    });

    if (this.props.resetOnError) {
      this.setState({
        initialData: {},
      });
    }

    this.props.onSubmitError && this.props.onSubmitError(error);
  };

  onFieldChange = (name: string, value: string | number) => {
    this.setState(state => ({
      data: {
        ...state.data,
        [name]: value,
      },
    }));
  };

  render() {
    const isSaving = this.state.state === FormState.SAVING;
    const {initialData, data} = this.state;
    const {errorMessage, hideErrors, requireChanges} = this.props;
    const hasChanges = requireChanges
      ? Object.keys(data).length && !isEqual(data, initialData)
      : true;
    const isError = this.state.state === FormState.ERROR;
    const nonFieldErrors = this.state.errors && this.state.errors.non_field_errors;

    return (
      <StyledForm onSubmit={this.onSubmit} className={this.props.className}>
        {isError && !hideErrors && (
          <div className="alert alert-error alert-block">
            {nonFieldErrors ? (
              <div>
                <p>
                  {t(
                    'Unable to save your changes. Please correct the following errors try again.'
                  )}
                </p>
                <ul>
                  {nonFieldErrors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </div>
            ) : (
              errorMessage
            )}
          </div>
        )}
        {this.props.children}
        <div className={this.props.footerClass} style={{marginTop: 25}}>
          <button
            className="btn btn-primary"
            disabled={isSaving || this.props.submitDisabled || !hasChanges}
            type="submit"
          >
            {this.props.submitLabel}
          </button>
          {this.props.onCancel && (
            <button
              type="button"
              className="btn btn-default"
              disabled={isSaving}
              onClick={this.props.onCancel}
              style={{marginLeft: 5}}
            >
              {this.props.cancelLabel}
            </button>
          )}
          {this.props.extraButton}
        </div>
      </StyledForm>
    );
  }
}

// Note: this is so we can use this as a selector for SelectField
// We need to keep `Form` as a React Component because ApiForm extends it :/
export const StyledForm = styled('form')``;

export default Form;
