import {Component} from 'react';
import isFunction from 'lodash/isFunction';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
  clearIndicators,
} from 'sentry/actionCreators/indicator';
import {Client} from 'sentry/api';
import GenericField from 'sentry/components/deprecatedforms/genericField';
import FormState from 'sentry/components/forms/state';
import {t} from 'sentry/locale';

const callbackWithArgs = function (context: any, callback: any, ...args: any) {
  return isFunction(callback) ? callback.bind(context, ...args) : undefined;
};

type GenericFieldProps = Parameters<typeof GenericField>[0];

type Props = {};

type State = {state: FormState};

class PluginComponentBase<
  P extends Props = Props,
  S extends State = State,
> extends Component<P, S> {
  constructor(props: P, context: any) {
    super(props, context);

    [
      'onLoadSuccess',
      'onLoadError',
      'onSave',
      'onSaveSuccess',
      'onSaveError',
      'onSaveComplete',
      'renderField',
      // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    ].map(method => (this[method] = this[method].bind(this)));

    if (this.fetchData) {
      this.fetchData = this.onLoad.bind(this, this.fetchData.bind(this));
    }
    if (this.onSubmit) {
      this.onSubmit = this.onSave.bind(this, this.onSubmit.bind(this));
    }
    this.state = {
      state: FormState.READY,
    } as Readonly<S>;
  }

  componentWillUnmount() {
    this.api.clear();
    window.clearTimeout(this.successMessageTimeout);
    window.clearTimeout(this.errorMessageTimeout);
  }

  successMessageTimeout: number | undefined = undefined;
  errorMessageTimeout: number | undefined = undefined;

  api = new Client();

  fetchData() {
    // Allow children to implement this
  }

  onSubmit() {
    // Allow children to implement this
  }

  onLoad(callback: any, ...args: any[]) {
    this.setState(
      {
        state: FormState.LOADING,
      },
      callbackWithArgs(this, callback, ...args)
    );
  }

  onLoadSuccess() {
    this.setState({
      state: FormState.READY,
    });
  }

  onLoadError(callback: any, ...args: any[]) {
    this.setState(
      {
        state: FormState.ERROR,
      },
      callbackWithArgs(this, callback, ...args)
    );
    addErrorMessage(t('An error occurred.'));
  }

  onSave(callback: any, ...args: any[]) {
    if (this.state.state === FormState.SAVING) {
      return;
    }
    callback = callbackWithArgs(this, callback, ...args);
    this.setState(
      {
        state: FormState.SAVING,
      },
      () => {
        addLoadingMessage(t('Saving changes\u2026'));
        callback?.();
      }
    );
  }

  onSaveSuccess(callback: any, ...args: any[]) {
    callback = callbackWithArgs(this, callback, ...args);
    this.setState(
      {
        state: FormState.READY,
      },
      () => callback?.()
    );

    window.clearTimeout(this.successMessageTimeout);
    this.successMessageTimeout = window.setTimeout(() => {
      addSuccessMessage(t('Success!'));
    }, 0);
  }

  onSaveError(callback: any, ...args: any[]) {
    callback = callbackWithArgs(this, callback, ...args);
    this.setState(
      {
        state: FormState.ERROR,
      },
      () => callback?.()
    );

    window.clearTimeout(this.errorMessageTimeout);
    this.errorMessageTimeout = window.setTimeout(() => {
      addErrorMessage(t('Unable to save changes. Please try again.'));
    }, 0);
  }

  onSaveComplete(callback: any, ...args: any[]) {
    clearIndicators();
    callback = callbackWithArgs(this, callback, ...args);
    callback?.();
  }

  renderField(props: Omit<GenericFieldProps, 'formState'>): React.ReactNode {
    props = {...props};
    const newProps = {
      ...props,
      formState: this.state.state,
    };
    return <GenericField key={newProps.config?.name} {...newProps} />;
  }
}

export default PluginComponentBase;
