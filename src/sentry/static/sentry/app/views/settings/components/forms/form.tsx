import {Observer} from 'mobx-react';
import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';

import {APIRequestMethod} from 'app/api';
import {t} from 'app/locale';
import Button from 'app/components/button';
import FormModel, {FormOptions} from 'app/views/settings/components/forms/model';
import Panel from 'app/components/panels/panel';
import space from 'app/styles/space';
import {isRenderFunc} from 'app/utils/isRenderFunc';

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
  'data-test-id'?: string;

  onCancel?: (e: React.MouseEvent) => void;
  onSubmit?: (
    data: Data,
    onSubmitSuccess: (data: Data) => void,
    onSubmitError: (error: any) => void,
    e: React.FormEvent,
    model: FormModel
  ) => void;
} & Pick<FormOptions, 'onSubmitSuccess' | 'onSubmitError' | 'onFieldChange'>;

type Context = {
  saveOnBlur: boolean;
  form: FormModel;
};

export default class Form extends React.Component<Props> {
  static propTypes: any = {
    cancelLabel: PropTypes.string,
    onCancel: PropTypes.func,
    onSubmit: PropTypes.func,
    onSubmitSuccess: PropTypes.func,
    onSubmitError: PropTypes.func,
    onFieldChange: PropTypes.func,
    submitDisabled: PropTypes.bool,
    submitLabel: PropTypes.string,
    submitPriority: PropTypes.string,
    footerClass: PropTypes.string,
    footerStyle: PropTypes.object,
    extraButton: PropTypes.element,
    initialData: PropTypes.object,
    // Require changes before able to submit form
    requireChanges: PropTypes.bool,
    // Reset form when there are errors, after submit
    resetOnError: PropTypes.bool,
    hideFooter: PropTypes.bool,
    allowUndo: PropTypes.bool,
    // Save field on control blur
    saveOnBlur: PropTypes.bool,
    model: PropTypes.object,
    apiMethod: PropTypes.string,
    apiEndpoint: PropTypes.string,
    'data-test-id': PropTypes.string,
  };

  static childContextTypes = {
    saveOnBlur: PropTypes.bool.isRequired,
    form: PropTypes.object.isRequired,
  };

  static defaultProps = {
    cancelLabel: t('Cancel'),
    submitLabel: t('Save Changes'),
    submitDisabled: false,
    submitPriority: 'primary' as 'primary',
    className: 'form-stacked',
    requireChanges: false,
    allowUndo: false,
    saveOnBlur: false,
  };

  constructor(props: Props, context: Context) {
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

  getChildContext() {
    return {
      saveOnBlur: this.props.saveOnBlur,
      form: this.model,
    };
  }

  componentWillUnmount() {
    this.model.reset();
  }

  model: FormModel = this.props.model || new FormModel();

  onSubmit = e => {
    e.preventDefault();
    if (this.model.isSaving) {
      return;
    }

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
      <form
        onSubmit={this.onSubmit}
        className={className}
        data-test-id={this.props['data-test-id']}
      >
        <div>
          {isRenderFunc<RenderFunc>(children) ? children({model: this.model}) : children}
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
                      {cancelLabel}
                    </Button>
                  )}
                </Observer>
              )}

              <Observer>
                {() => (
                  <Button
                    data-test-id="form-submit"
                    priority={submitPriority}
                    disabled={
                      this.model.isError ||
                      this.model.isSaving ||
                      submitDisabled ||
                      (requireChanges ? !this.model.formChanged : false)
                    }
                    type="submit"
                  >
                    {submitLabel}
                  </Button>
                )}
              </Observer>
            </DefaultButtons>
          </StyledFooter>
        )}
      </form>
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
  .modal-content & {
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
