import React from 'react';
import _ from 'underscore';

import {FormState} from '../../components/forms';
import IndicatorStore from '../../stores/indicatorStore';
import {t} from '../../locale';


const callbackWithArgs = function(callback, ...args) {
  if (_.isFunction(callback)) {
    callback = callback.bind(this, ...args);
  } else {
    callback = null;
  }
  return callback;
};


class SettingsBase extends React.Component {
  constructor(props) {
    super(props);

    ['onLoad',
     'onLoadSuccess',
     'onLoadError',
     'onSave',
     'onSaveSuccess',
     'onSaveError',
     'onSaveComplete'].map(method => this[method] = this[method].bind(this));

    this.state = {
      state: FormState.READY
    };
  }

  onLoad(callback, ...args) {
    this.setState({
      state: FormState.LOADING
    }, callbackWithArgs(callback, ...args));
  }

  onLoadSuccess(callback, ...args) {
    this.setState({
      state: FormState.READY
    }, callbackWithArgs(callback, ...args));
  }

  onLoadError(callback, ...args) {
    this.setState({
      state: FormState.ERROR
    }, callbackWithArgs(callback, ...args));
  }

  onSave(callback, ...args) {
    if (this.state.state == FormState.SAVING) {
      return;
    }
    callback = callbackWithArgs(callback, ...args);
    this.setState({
      state: FormState.SAVING,
    }, () => {
      this._loadingIndicator = IndicatorStore.add(t('Saving changes..'));
      callback && callback();
    });
  }

  onSaveSuccess(callback, ...args) {
    this.setState({
      state: FormState.READY
    }, callbackWithArgs(callback, ...args));
  }

  onSaveError(callback, ...args) {
    callback = callbackWithArgs(callback, ...args);
    this.setState({
      state: FormState.ERROR,
    }, () => {
      IndicatorStore.add(t('Unable to save changes. Please try again.'), 'error', {
        duration: 3000
      });
      callback && callback();
    });
  }

  onSaveComplete(callback, ...args) {
    IndicatorStore.remove(this._loadingIndicator);
    callback = callbackWithArgs(callback, ...args);
    callback && callback();
  }
}

export default SettingsBase;
