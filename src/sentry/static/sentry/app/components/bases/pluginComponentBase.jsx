import React from 'react';
import isFunction from 'lodash/isFunction';

import {Client} from 'app/api';
import {FormState, GenericField} from 'app/components/forms';
import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
  clearIndicators,
} from 'app/actionCreators/indicator';
import {t} from 'app/locale';

const callbackWithArgs = function (callback, ...args) {
  if (isFunction(callback)) {
    callback = callback.bind(this, ...args);
  } else {
    callback = null;
  }
  return callback;
};

class PluginComponentBase extends React.Component {
  constructor(props, context) {
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
    };
  }

  UNSAFE_componentWillMount() {
    this.api = new Client();
  }

  componentWillUnmount() {
    this.api.clear();
  }

  onLoad(callback, ...args) {
    this.setState(
      {
        state: FormState.LOADING,
      },
      callbackWithArgs(callback, ...args)
    );
  }

  onLoadSuccess(callback, ...args) {
    this.setState(
      {
        state: FormState.READY,
      },
      callbackWithArgs(callback, ...args)
    );
  }

  onLoadError(callback, ...args) {
    this.setState(
      {
        state: FormState.ERROR,
      },
      callbackWithArgs(callback, ...args)
    );
    addErrorMessage(t('An error occurred.'));
  }

  onSave(callback, ...args) {
    if (this.state.state === FormState.SAVING) {
      return;
    }
    callback = callbackWithArgs(callback, ...args);
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
    callback = callbackWithArgs(callback, ...args);
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
    callback = callbackWithArgs(callback, ...args);
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
    callback = callbackWithArgs(callback, ...args);
    callback && callback();
  }

  renderField(props) {
    props = {...props};
    props.formState = this.state.state;
    props.config = props.config || {};
    return <GenericField key={props.config.name} {...props} />;
  }
}

export default PluginComponentBase;
