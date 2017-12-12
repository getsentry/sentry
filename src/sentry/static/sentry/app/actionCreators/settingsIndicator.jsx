import {DEFAULT_TOAST_DURATION} from '../constants';
import SettingsIndicatorActions from '../actions/settingsIndicatorActions';

let clearId;

export function remove() {
  SettingsIndicatorActions.remove();
}

export function undo() {
  SettingsIndicatorActions.undo();
}

export function addMessage(msg, type, options = {}) {
  let {duration} = options;

  // use default only if undefined, as 0 is a valid duration
  duration = typeof duration === 'undefined' ? DEFAULT_TOAST_DURATION : duration;

  SettingsIndicatorActions.add(msg, type, options);

  // clear existing timeout if exists
  if (duration && clearId) {
    window.clearTimeout(clearId);
  }

  if (duration) {
    clearId = window.setTimeout(remove, duration);
  }
}

export function addErrorMessage(msg, duration, options = {}) {
  addMessage(msg, 'error', {...options, duration});
}

export function addSuccessMessage(msg, duration, options = {}) {
  addMessage(msg, 'success', {...options, duration});
}
