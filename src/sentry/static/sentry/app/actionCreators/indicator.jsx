import {DEFAULT_TOAST_DURATION} from '../constants';
import IndicatorActions from '../actions/indicatorActions';

export function remove(indicator) {
  IndicatorActions.remove(indicator);
}

export function undo() {
  IndicatorActions.undo();
}

export function addMessage(msg, type, options = {}) {
  let {duration} = options;

  // use default only if undefined, as 0 is a valid duration
  duration = typeof duration === 'undefined' ? DEFAULT_TOAST_DURATION : duration;

  IndicatorActions.add(msg, type, {...options, duration});
}

export function addErrorMessage(msg, duration, options = {}) {
  addMessage(msg, 'error', {...options, duration});
}

export function addSuccessMessage(msg, duration, options = {}) {
  addMessage(msg, 'success', {...options, duration});
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
