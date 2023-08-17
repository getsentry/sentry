import {useCallback, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import {Observer} from 'mobx-react';

import {Button, ButtonProps} from 'sentry/components/button';
import FormContext from 'sentry/components/forms/formContext';
import FormModel, {FormOptions} from 'sentry/components/forms/model';
import {Data, OnSubmitCallback} from 'sentry/components/forms/types';
import Panel from 'sentry/components/panels/panel';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {isRenderFunc} from 'sentry/utils/isRenderFunc';

type RenderProps = {
  model: FormModel;
};

type RenderFunc = (props: RenderProps) => React.ReactNode;

export interface FormProps
  extends Pick<
    FormOptions,
    | 'allowUndo'
    | 'resetOnError'
    | 'saveOnBlur'
    | 'apiEndpoint'
    | 'apiMethod'
    | 'onFieldChange'
    | 'onSubmitError'
    | 'onSubmitSuccess'
  > {
  additionalFieldProps?: {[key: string]: any};
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
  'data-test-id': dataTestId,
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
  model,
  onCancel,
  onFieldChange,
  onPreSubmit,
  onSubmit,
  onSubmitError,
  onSubmitSuccess,
  preventFormResetOnUnmount,
  requireChanges,
  resetOnError,
  saveOnBlur,
  skipPreventDefault,
  submitDisabled,
  submitLabel,
  submitPriority,
}: FormProps) {
  const [formModel] = useState(() => {
    const resolvedModel = model ?? new FormModel();

    // XXX(epurkhiser): We do this as part of the state construction to ensure
    // model data and options are set immediately
    //
    // TODO(epurkhiser): To have options and initialData be reactive properties
    // we'll have to make some changes to the cosnumers of models.
    if (initialData) {
      resolvedModel.setInitialData(initialData);
    }

    resolvedModel.setFormOptions({
      resetOnError,
      allowUndo,
      onFieldChange,
      onSubmitSuccess,
      onSubmitError,
      saveOnBlur,
      apiEndpoint,
      apiMethod,
    });

    return resolvedModel;
  });

  // Reset form model on un,out
  useEffect(
    () => () => {
      if (!preventFormResetOnUnmount) {
        formModel.reset();
      }
    },
    [formModel, preventFormResetOnUnmount]
  );

  const contextData = useMemo(
    () => ({saveOnBlur, form: formModel}),
    [formModel, saveOnBlur]
  );

  const handleSubmitSuccess = useCallback(
    data => {
      formModel.submitSuccess(data);
      onSubmitSuccess?.(data, formModel);
    },
    [formModel, onSubmitSuccess]
  );

  const handleSubmitError = useCallback(
    error => {
      formModel.submitError(error);
      onSubmitError?.(error, formModel);
    },
    [formModel, onSubmitError]
  );

  const handleSubmit = useCallback(
    e => {
      if (!skipPreventDefault) {
        e.preventDefault();
      }
      if (formModel.isSaving) {
        return;
      }

      onPreSubmit?.();

      onSubmit?.(
        formModel.getData(),
        handleSubmitSuccess,
        handleSubmitError,
        e,
        formModel
      );

      if (!onSubmit) {
        formModel.saveForm();
      }
    },
    [
      formModel,
      handleSubmitError,
      handleSubmitSuccess,
      onPreSubmit,
      onSubmit,
      skipPreventDefault,
    ]
  );

  const shouldShowFooter = typeof hideFooter !== 'undefined' ? !hideFooter : !saveOnBlur;

  return (
    <FormContext.Provider value={contextData}>
      <form
        onSubmit={handleSubmit}
        className={className ?? 'form-stacked'}
        data-test-id={dataTestId}
      >
        <div>
          {isRenderFunc<RenderFunc>(children) ? children({model: formModel}) : children}
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
                      disabled={formModel.isSaving}
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
                      formModel.isError ||
                      formModel.isSaving ||
                      submitDisabled ||
                      (requireChanges ? !formModel.formChanged : false)
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
    padding-right: ${space(2)}
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
