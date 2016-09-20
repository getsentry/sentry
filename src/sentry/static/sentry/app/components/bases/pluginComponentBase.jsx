import React from 'react';
import _ from 'underscore';

import {Client} from '../../api';
import {FormState, GenericField} from '../../components/forms';
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


class PluginComponentBase extends React.Component {
  constructor(props) {
    super(props);

    ['onLoadSuccess',
     'onLoadError',
     'onSave',
     'onSaveSuccess',
     'onSaveError',
     'onSaveComplete',
     'renderField'].map(method => this[method] = this[method].bind(this));

    if (this.fetchData) {
      this.fetchData = this.onLoad.bind(this, this.fetchData.bind(this));
    }
    if (this.onSubmit) {
      this.onSubmit = this.onSave.bind(this, this.onSubmit.bind(this));
    }

    this.state = {
      state: FormState.READY
    };
  }

  componentWillMount() {
    this.api = new Client();
  }

  componentWillUnmount() {
    this.api.clear();
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
    IndicatorStore.add(t('An error occurred.'), 'error', {
      duration: 3000
    });
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
    IndicatorStore.add(t('Success!'), 'success', {
      duration: 3000
    });
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

  renderField(props) {
    return <GenericField {...props}/>;
  }
}

export default PluginComponentBase;
