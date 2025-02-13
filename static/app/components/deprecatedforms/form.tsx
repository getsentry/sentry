import {Component} from 'react';
import styled from '@emotion/styled';
import isEqual from 'lodash/isEqual';

import {Button} from 'sentry/components/button';
import type {FormContextData} from 'sentry/components/deprecatedforms/formContext';
import FormContext from 'sentry/components/deprecatedforms/formContext';
import FormState from 'sentry/components/forms/state';
import {t} from 'sentry/locale';

type FormProps = {
  cancelLabel?: string;
  children?: React.ReactNode;
  className?: string;
  errorMessage?: React.ReactNode;
  extraButton?: React.ReactNode;
  footerClass?: string;
  hideErrors?: boolean;
  initialData?: Record<PropertyKey, unknown>;
  onCancel?: () => void;
  onSubmit?: (
    data: Record<PropertyKey, unknown>,
    onSubmitSuccess: (data: Record<PropertyKey, unknown>) => void,
    onSubmitError: (error: Record<PropertyKey, unknown>) => void
  ) => void;
  onSubmitError?: (error: Record<PropertyKey, unknown>) => void;
  onSubmitSuccess?: (data: Record<PropertyKey, unknown>) => void;
  requireChanges?: boolean;
  resetOnError?: boolean;
  submitDisabled?: boolean;
  submitLabel?: string;
};

type FormClassState = {
  data: any;
  errors: {non_field_errors?: Array<Record<PropertyKey, unknown>>} & Record<
    PropertyKey,
    string
  >;
  initialData: Record<PropertyKey, unknown>;
  state: FormState;
};

// Re-export for compatibility alias.
export type Context = FormContextData;

class Form<
  Props extends FormProps = FormProps,
  State extends FormClassState = FormClassState,
> extends Component<Props, State> {
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

  onSubmitSuccess = (data: Record<PropertyKey, unknown>) => {
    this.setState({
      state: FormState.READY,
      errors: {},
      initialData: {...this.state.data, ...(data || {})},
    });
    this.props.onSubmitSuccess?.(data);
  };

  onSubmitError = (error: any) => {
    this.setState({
      state: FormState.ERROR,
      errors: error.responseJSON,
    });

    if (this.props.resetOnError) {
      this.setState({
        initialData: {},
      });
    }

    this.props.onSubmitError?.(error);
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
    const nonFieldErrors = this.state.errors?.non_field_errors;

    return (
      <FormContext.Provider value={this.getContext()}>
        <StyledForm
          onSubmit={this.onSubmit}
          className={this.props.className}
          aria-label={(this.props as any)['aria-label']}
        >
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
                      // TODO(TS): Objects cannot be rendered to dom
                      <li key={i}>{e as any}</li>
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
