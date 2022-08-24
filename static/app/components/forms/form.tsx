import {useCallback, useEffect, useState} from 'react';
import styled from '@emotion/styled';
import {Observer} from 'mobx-react';

import {APIRequestMethod} from 'sentry/api';
import Button, {ButtonProps} from 'sentry/components/button';
import FormContext from 'sentry/components/forms/formContext';
import FormModel, {FormOptions} from 'sentry/components/forms/model';
import {Data, OnSubmitCallback} from 'sentry/components/forms/types';
import Panel from 'sentry/components/panels/panel';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {isRenderFunc} from 'sentry/utils/isRenderFunc';

type RenderProps = {
  model: FormModel;
};

type RenderFunc = (props: RenderProps) => React.ReactNode;

export interface FormProps
  extends Pick<FormOptions, 'onSubmitSuccess' | 'onSubmitError' | 'onFieldChange'> {
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
}

function Form({
  model: propsModel,
  allowUndo,
  apiEndpoint,
  apiMethod,
  cancelLabel,
  children,
  className,
  extraButton,
  footerClass,
  footerStyle,
  hideFooter,
  initialData,
  onCancel,
  onFieldChange,
  onPreSubmit,
  onSubmit,
  onSubmitError,
  onSubmitSuccess,
  requireChanges,
  resetOnError,
  saveOnBlur,
  skipPreventDefault,
  submitDisabled,
  submitLabel,
  submitPriority,
  preventFormResetOnUnmount,
  ...props
}: FormProps) {
  const [model] = useState<FormModel>(() => {
    const instance = propsModel ?? new FormModel();

    instance.setInitialData(initialData);
    instance.setFormOptions({
      resetOnError,
      allowUndo,
      onFieldChange,
      onSubmitSuccess,
      onSubmitError,
      saveOnBlur,
      apiEndpoint,
      apiMethod,
    });

    return instance;
  });

  // Reset model on unmount
  useEffect(
    () => () => void (!preventFormResetOnUnmount && model.reset()),
    [model, preventFormResetOnUnmount]
  );

  const handleSubmitSuccess = useCallback(
    data => {
      model.submitSuccess(data);
      onSubmitSuccess?.(data, model);
    },
    [model, onSubmitSuccess]
  );

  const handleSubmitError = useCallback(
    error => {
      model.submitError(error);
      onSubmitError?.(error, model);
    },
    [model, onSubmitError]
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      if (!skipPreventDefault) {
        e.preventDefault();
      }

      if (model.isSaving) {
        return;
      }

      onPreSubmit?.();
      onSubmit?.(model.getData(), handleSubmitSuccess, handleSubmitError, e, model);

      if (!onSubmit) {
        model.saveForm();
      }
    },
    [
      model,
      onSubmit,
      onPreSubmit,
      skipPreventDefault,
      handleSubmitSuccess,
      handleSubmitError,
    ]
  );

  const shouldShowFooter = typeof hideFooter !== 'undefined' ? !hideFooter : !saveOnBlur;

  const contextData = {saveOnBlur, form: model};

  return (
    <FormContext.Provider value={contextData}>
      <form
        onSubmit={handleSubmit}
        className={className ?? 'form-stacked'}
        data-test-id={props['data-test-id']}
      >
        <div>{isRenderFunc<RenderFunc>(children) ? children({model}) : children}</div>

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
                      disabled={model.isSaving}
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
                      model.isError ||
                      model.isSaving ||
                      submitDisabled ||
                      (requireChanges ? !model.formChanged : false)
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

export default Form;

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
