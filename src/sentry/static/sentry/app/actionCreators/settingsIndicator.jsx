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
