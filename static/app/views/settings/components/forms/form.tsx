import * as React from 'react';
import styled from '@emotion/styled';
import {Observer} from 'mobx-react';

import {APIRequestMethod} from 'app/api';
import Button from 'app/components/button';
import Panel from 'app/components/panels/panel';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {isRenderFunc} from 'app/utils/isRenderFunc';
import FormContext, {
  FormContextData,
} from 'app/views/settings/components/forms/formContext';
import FormModel, {FormOptions} from 'app/views/settings/components/forms/model';

type Data = Record<string, any>;

type RenderProps = {
  model: FormModel;
};

type RenderFunc = (props: RenderProps) => React.ReactNode;

type Props = {
  apiMethod?: APIRequestMethod;
  apiEndpoint?: string;
  children?: React.ReactNode | RenderFunc;
  className?: string;
  cancelLabel?: string;
  submitDisabled?: boolean;
  submitLabel?: string;
  submitPriority?: React.ComponentProps<typeof Button>['priority'];
  footerClass?: string;
  footerStyle?: React.CSSProperties;
  extraButton?: React.ReactNode;
  initialData?: Data;
  // Require changes before able to submit form
  requireChanges?: boolean;
  // Reset form when there are errors; after submit
  resetOnError?: boolean;
  hideFooter?: boolean;
  allowUndo?: boolean;
  // Save field on control blur
  saveOnBlur?: boolean;
  model?: FormModel;
  // if set to true, preventDefault is not called
  skipPreventDefault?: boolean;
  additionalFieldProps?: {[key: string]: any};
  'data-test-id'?: string;

  onCancel?: (e: React.MouseEvent) => void;
  onSubmit?: (
    data: Data,
    onSubmitSuccess: (data: Data) => void,
    onSubmitError: (error: any) => void,
    e: React.FormEvent,
    model: FormModel
  ) => void;
  onPreSubmit?: () => void;
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
    this.model.reset();
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
  border-top: 1px solid #e9ebec;
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
  grid-gap: ${space(1)};
  grid-auto-flow: column;
  justify-content: flex-end;
  flex: 1;
`;
