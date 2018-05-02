import {DEFAULT_TOAST_DURATION} from 'app/constants';
import {t} from 'app/locale';
import IndicatorActions from 'app/actions/indicatorActions';

// Removes a single indicator
export function removeIndicator(indicator) {
  IndicatorActions.remove(indicator);
}

// Clears all indicators
export function clearIndicators() {
  IndicatorActions.clear();
}

// Note previous IndicatorStore.add behavior was to default to "loading" if no type was supplied
export function addMessage(msg, type, options = {}) {
  let {duration} = options;

  // use default only if undefined, as 0 is a valid duration
  duration = typeof duration === 'undefined' ? DEFAULT_TOAST_DURATION : duration;

  let action = options.append ? 'append' : 'replace';
  // XXX: This differs from `IndicatorStore.add` since it won't return the indicator that is created
  // because we are firing an action. You can just add a new message and it will, by default,
  // replace active indicator
  IndicatorActions[action](msg, type, {...options, duration});
}

function addMessageWithType(type) {
  return (msg, duration, options = {}) => addMessage(msg, type, {...options, duration});
}

export function addLoadingMessage(msg = t('Saving changes...'), ...args) {
  return addMessageWithType('loading')(msg, ...args);
}

export function addErrorMessage(...args) {
  return addMessageWithType('error')(...args);
}

export function addSuccessMessage(...args) {
  return addMessageWithType('success')(...args);
}

/**
 * This will call an action creator to generate a "Toast" message that
 * notifies user the field that changed with its previous and current values.
 *
 * Also allows for undo
 */

export function saveOnBlurUndoMessage(change, model, fieldName) {
  if (!model) return;

  let label = model.getDescriptor(fieldName, 'label');

  if (!label) return;

  addSuccessMessage(
    `Changed ${label} from "${change.old}" to "${change.new}"`,
    DEFAULT_TOAST_DURATION,
    {
      model,
      id: fieldName,
      undo: () => {
        if (!model || !fieldName) return;

        let oldValue = model.getValue(fieldName);
        let didUndo = model.undo();
        let newValue = model.getValue(fieldName);

        if (!didUndo) return;
        if (!label) return;

        model.saveField(fieldName, newValue).then(() => {
          addMessage(`Restored ${label} from "${oldValue}" to "${newValue}"`, 'undo', {
            duration: DEFAULT_TOAST_DURATION,
          });
        });
      },
    }
  );
}
