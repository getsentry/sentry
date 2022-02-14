import * as React from 'react';
import styled from '@emotion/styled';
import isEqual from 'lodash/isEqual';

import Button from 'sentry/components/button';
import FormContext, {
  FormContextData,
} from 'sentry/components/deprecatedforms/formContext';
import FormState from 'sentry/components/forms/state';
import {t} from 'sentry/locale';

type FormProps = {
  cancelLabel?: string;
  className?: string;
  errorMessage?: React.ReactNode;
  extraButton?: React.ReactNode;
  footerClass?: string;
  hideErrors?: boolean;
  initialData?: object;
  onCancel?: () => void;
  onSubmit?: (
    data: object,
    onSubmitSuccess: (data: object) => void,
    onSubmitError: (error: object) => void
  ) => void;
  onSubmitError?: (error: object) => void;
  onSubmitSuccess?: (data: object) => void;
  requireChanges?: boolean;
  resetOnError?: boolean;
  submitDisabled?: boolean;
  submitLabel?: string;
};

type FormClassState = {
  data: any;
  errors: {non_field_errors?: object[]} & object;
  initialData: object;
  state: FormState;
};

// Re-export for compatibility alias.
export type Context = FormContextData;

class Form<
  Props extends FormProps = FormProps,
  State extends FormClassState = FormClassState
> extends React.Component<Props, State> {
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

  getContext() {
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
    this.setState({
      state: FormState.READY,
      errors: {},
      initialData: {...this.state.data, ...(data || {})},
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
      <FormContext.Provider value={this.getContext()}>
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
            <Button
              priority="primary"
              disabled={isSaving || this.props.submitDisabled || !hasChanges}
              type="submit"
              aria-label={this.props.submitLabel ?? t('Submit')}
            >
              {this.props.submitLabel}
            </Button>
            {this.props.onCancel && (
              <Button
                type="button"
                disabled={isSaving}
                onClick={this.props.onCancel}
                style={{marginLeft: 5}}
                aria-label={this.props.cancelLabel ?? t('Cancel')}
              >
                {this.props.cancelLabel}
              </Button>
            )}
            {this.props.extraButton}
          </div>
        </StyledForm>
      </FormContext.Provider>
    );
  }
}

// Note: this is so we can use this as a selector for SelectField
// We need to keep `Form` as a React Component because ApiForm extends it :/
export const StyledForm = styled('form')``;

export default Form;
