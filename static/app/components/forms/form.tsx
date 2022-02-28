import * as React from 'react';
import styled from '@emotion/styled';
import {Observer} from 'mobx-react';

import {APIRequestMethod} from 'sentry/api';
import Button, {ButtonProps} from 'sentry/components/button';
import FormContext, {FormContextData} from 'sentry/components/forms/formContext';
import FormModel, {FormOptions} from 'sentry/components/forms/model';
import {Data, OnSubmitCallback} from 'sentry/components/forms/type';
import Panel from 'sentry/components/panels/panel';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {isRenderFunc} from 'sentry/utils/isRenderFunc';

type RenderProps = {
  model: FormModel;
};

type RenderFunc = (props: RenderProps) => React.ReactNode;

type Props = {
  additionalFieldProps?: {[key: string]: any};
  allowUndo?: boolean;
  /**
   * The URL to the API endpoint this form submits to.
   */
  apiEndpoint?: string;
  /**
   * The HTTP method to use.
   */
  apiMethod?: APIRequestMethod;
  cancelLabel?: string;
  children?: React.ReactNode | RenderFunc;
  className?: string;
  'data-test-id'?: string;
  extraButton?: React.ReactNode;
  footerClass?: string;
  footerStyle?: React.CSSProperties;
  hideFooter?: boolean;
  initialData?: Data;
  /**
   * A FormModel instance. If undefined a FormModel will be created for you.
   */
  model?: FormModel;
  /**
   * Callback fired when the form is cancelled via the cancel button.
   */
  onCancel?: (e: React.MouseEvent) => void;
  onPreSubmit?: () => void;
  /**
   * Callback to handle form submission.
   *
   * Defining this prop will replace the normal API submission behavior
   * and instead only call the provided callback.
   *
   * Your callback is expected to call `onSubmitSuccess` when the action succeeds and
   * `onSubmitError` when the action fails.
   */
  onSubmit?: OnSubmitCallback;
  /**
   * Ensure the form model isn't reset when the form unmounts
   */
  preventFormResetOnUnmount?: boolean;
  /**
   * Are changed required before the form can be submitted.
   */
  requireChanges?: boolean;
  /**
   * Should the form reset its state when there are errors after submission.
   */
  resetOnError?: boolean;
  /**
   * Should fields save individually as they are blurred.
   */
  saveOnBlur?: boolean;

  /**
   * If set to true, preventDefault is not called
   */
  skipPreventDefault?: boolean;
  /**
   * Should the submit button be disabled.
   */
  submitDisabled?: boolean;
  submitLabel?: string;
  submitPriority?: ButtonProps['priority'];
} & Pick<FormOptions, 'onSubmitSuccess' | 'onSubmitError' | 'onFieldChange'>;

export default class Form extends React.Component<Props> {
  constructor(props: Props, context: FormContextData) {
    super(props, context);
    const {
      saveOnBlur,
      apiEndpoint,
      apiMethod,
      resetOnError,
      onSubmitSuccess,
      onSubmitError,
      onFieldChange,
      initialData,
      allowUndo,
    } = props;

    this.model.setInitialData(initialData);
    this.model.setFormOptions({
      resetOnError,
      allowUndo,
      onFieldChange,
      onSubmitSuccess,
      onSubmitError,
      saveOnBlur,
      apiEndpoint,
      apiMethod,
    });
  }

  componentWillUnmount() {
    !this.props.preventFormResetOnUnmount && this.model.reset();
  }

  model: FormModel = this.props.model || new FormModel();

  contextData() {
    return {
      saveOnBlur: this.props.saveOnBlur,
      form: this.model,
    };
  }

  onSubmit = e => {
    !this.props.skipPreventDefault && e.preventDefault();
    if (this.model.isSaving) {
      return;
    }

    this.props.onPreSubmit?.();

    if (this.props.onSubmit) {
      this.props.onSubmit(
        this.model.getData(),
        this.onSubmitSuccess,
        this.onSubmitError,
        e,
        this.model
      );
    } else {
      this.model.saveForm();
    }
  };

  onSubmitSuccess = data => {
    const {onSubmitSuccess} = this.props;
    this.model.submitSuccess(data);

    if (onSubmitSuccess) {
      onSubmitSuccess(data, this.model);
    }
  };

  onSubmitError = error => {
    const {onSubmitError} = this.props;
    this.model.submitError(error);

    if (onSubmitError) {
      onSubmitError(error, this.model);
    }
  };

  render() {
    const {
      className,
      children,
      footerClass,
      footerStyle,
      submitDisabled,
      submitLabel,
      submitPriority,
      cancelLabel,
      onCancel,
      extraButton,
      requireChanges,
      saveOnBlur,
      hideFooter,
    } = this.props;
    const shouldShowFooter =
      typeof hideFooter !== 'undefined' ? !hideFooter : !saveOnBlur;

    return (
      <FormContext.Provider value={this.contextData()}>
        <form
          onSubmit={this.onSubmit}
          className={className ?? 'form-stacked'}
          data-test-id={this.props['data-test-id']}
        >
          <div>
            {isRenderFunc<RenderFunc>(children)
              ? children({model: this.model})
              : children}
          </div>

          {shouldShowFooter && (
            <StyledFooter
              className={footerClass}
              style={footerStyle}
              saveOnBlur={saveOnBlur}
            >
              {extraButton}
              <DefaultButtons>
                {onCancel && (
                  <Observer>
                    {() => (
                      <Button
                        type="button"
                        disabled={this.model.isSaving}
                        onClick={onCancel}
                        style={{marginLeft: 5}}
                      >
                        {cancelLabel ?? t('Cancel')}
                      </Button>
                    )}
                  </Observer>
                )}

                <Observer>
                  {() => (
                    <Button
                      data-test-id="form-submit"
                      priority={submitPriority ?? 'primary'}
                      disabled={
                        this.model.isError ||
                        this.model.isSaving ||
                        submitDisabled ||
                        (requireChanges ? !this.model.formChanged : false)
                      }
                      type="submit"
                    >
                      {submitLabel ?? t('Save Changes')}
                    </Button>
                  )}
                </Observer>
              </DefaultButtons>
            </StyledFooter>
          )}
        </form>
      </FormContext.Provider>
    );
  }
}

const StyledFooter = styled('div')<{saveOnBlur?: boolean}>`
  display: flex;
  justify-content: flex-end;
  margin-top: 25px;
  border-top: 1px solid ${p => p.theme.innerBorder};
  background: none;
  padding: 16px 0 0;
  margin-bottom: 16px;

  ${p =>
    !p.saveOnBlur &&
    `
  ${Panel} & {
    margin-top: 0;
    padding-right: 36px;
  }

  /* Better padding with form inside of a modal */
  [role='document'] & {
    padding-right: 30px;
    margin-left: -30px;
    margin-right: -30px;
    margin-bottom: -30px;
    margin-top: 16px;
    padding-bottom: 16px;
  }
  `};
`;

const DefaultButtons = styled('div')`
  display: grid;
  gap: ${space(1)};
  grid-auto-flow: column;
  justify-content: flex-end;
  flex: 1;
`;
