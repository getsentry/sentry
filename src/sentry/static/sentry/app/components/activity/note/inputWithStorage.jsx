import debounce from 'lodash/debounce';
import PropTypes from 'prop-types';
import React from 'react';
import * as Sentry from '@sentry/browser';

import NoteInput from 'app/components/activity/note/input';
import localStorage from 'app/utils/localStorage';

class NoteInputWithStorage extends React.Component {
  static propTypes = {
    storageKey: PropTypes.string.isRequired,
    itemKey: PropTypes.string.isRequired,
    text: PropTypes.string,
    onLoad: PropTypes.func.isRequired,
    onSave: PropTypes.func.isRequired,
    onChange: PropTypes.func,
    onCreate: PropTypes.func,
  };

  static defaultProps = {
    onSave: i => i,
    onLoad: i => i,
  };

  fetchFromStorage = () => {
    const {storageKey} = this.props;

    const storage = localStorage.getItem(storageKey);
    if (!storage) {
      return null;
    }

    try {
      return JSON.parse(storage);
    } catch (err) {
      Sentry.withScope(scope => {
        scope.setExtra('storage', storage);
        Sentry.captureException(err);
      });
      return null;
    }
  };

  saveToStorage = obj => {
    const {storageKey} = this.props;

    try {
      localStorage.setItem(storageKey, JSON.stringify(obj));
    } catch (err) {
      Sentry.captureException(err);
      Sentry.withScope(scope => {
        scope.setExtra('storage', obj);
        Sentry.captureException(err);
      });
    }
  };

  getValue = () => {
    const {itemKey, text, onLoad} = this.props;

    if (text) {
      return text;
    }

    const storageObj = this.fetchFromStorage();

    if (!storageObj) {
      return '';
    }

    if (!storageObj.hasOwnProperty(itemKey)) {
      return '';
    }

    return onLoad(storageObj[itemKey]);
  };

  save = debounce(value => {
    const {itemKey, onSave} = this.props;

    const currentObj = this.fetchFromStorage() || {};
    this.saveToStorage({...currentObj, [itemKey]: onSave(value)});
  }, 150);

  handleChange = (e, options = {}) => {
    const {onChange} = this.props;

    if (onChange) {
      onChange(e, options);
    }

    if (options.updating) {
      return;
    }

    this.save(e.target.value);
  };

  /**
   * Handler when note is created.
   *
   * Remove in progress item from local storage if it exists
   */
  handleCreate = (...args) => {
    const {itemKey, onCreate} = this.props;

    if (onCreate) {
      onCreate(...args);
    }

    // Remove from local storage
    const storageObj = this.fetchFromStorage() || {};

    // Nothing from this `itemKey` is saved to storage, do nothing
    if (!storageObj.hasOwnProperty(itemKey)) {
      return;
    }

    // Remove `itemKey` from stored object and save to storage
    // eslint-disable-next-line no-unused-vars
    const {[itemKey]: _oldItem, ...newStorageObj} = storageObj;
    this.saveToStorage(newStorageObj);
  };

  render() {
    // Make sure `this.props` does not override `onChange` and `onCreate`
    return (
      <NoteInput
        {...this.props}
        text={this.getValue()}
        onCreate={this.handleCreate}
        onChange={this.handleChange}
      />
    );
  }
}

export default NoteInputWithStorage;
