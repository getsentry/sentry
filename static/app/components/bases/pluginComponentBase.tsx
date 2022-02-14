import * as React from 'react';
import isFunction from 'lodash/isFunction';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
  clearIndicators,
} from 'sentry/actionCreators/indicator';
import {Client} from 'sentry/api';
import {FormState, GenericField} from 'sentry/components/deprecatedforms';
import {t} from 'sentry/locale';

const callbackWithArgs = function (context: any, callback: any, ...args: any) {
  return isFunction(callback) ? callback.bind(context, ...args) : undefined;
};

type GenericFieldProps = Parameters<typeof GenericField>[0];

type Props = {};

type State = {state: GenericFieldProps['formState']};

class PluginComponentBase<
  P extends Props = Props,
  S extends State = State
> extends React.Component<P, S> {
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
  }

  api = new Client();

  fetchData() {
    // Allow children to implement this
  }

  onSubmit() {
    // Allow children to implement this
  }

  onLoad(callback, ...args) {
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

  onLoadError(callback, ...args) {
    this.setState(
      {
        state: FormState.ERROR,
      },
      callbackWithArgs(this, callback, ...args)
    );
    addErrorMessage(t('An error occurred.'));
  }

  onSave(callback, ...args) {
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
        callback && callback();
      }
    );
  }

  onSaveSuccess(callback, ...args) {
    callback = callbackWithArgs(this, callback, ...args);
    this.setState(
      {
        state: FormState.READY,
      },
      () => callback && callback()
    );
    setTimeout(() => {
      addSuccessMessage(t('Success!'));
    }, 0);
  }

  onSaveError(callback, ...args) {
    callback = callbackWithArgs(this, callback, ...args);
    this.setState(
      {
        state: FormState.ERROR,
      },
      () => callback && callback()
    );
    setTimeout(() => {
      addErrorMessage(t('Unable to save changes. Please try again.'));
    }, 0);
  }

  onSaveComplete(callback, ...args) {
    clearIndicators();
    callback = callbackWithArgs(this, callback, ...args);
    callback && callback();
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
