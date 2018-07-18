import React from 'react';
import styled from 'react-emotion';

import {DEFAULT_TOAST_DURATION} from 'app/constants';
import {t, tct} from 'app/locale';
import IndicatorActions from 'app/actions/indicatorActions';

// RFormValueoves a single indicator
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

// Transform form values into a string
// Otherwise bool values will not get rendered and empty strings look like a bug
const prettyFormString = val => {
  if (val === '') {
    return '<empty>';
  }

  return `${val}`;
};

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
    tct('Changed [fieldName] from [oldValue] to [newValue]', {
      fieldName: <strong>{label}</strong>,
      oldValue: <FormValue>{prettyFormString(change.old)}</FormValue>,
      newValue: <FormValue>{prettyFormString(change.new)}</FormValue>,
    }),
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

        // `saveField` can return null if it can't save
        let saveResult = model.saveField(fieldName, newValue);

        if (!saveResult) {
          addErrorMessage(
            tct('Unable to restore [fieldName] from [oldValue] to [newValue]', {
              fieldName: <strong>{label}</strong>,
              oldValue: <FormValue>{prettyFormString(oldValue)}</FormValue>,
              newValue: <FormValue>{prettyFormString(newValue)}</FormValue>,
            })
          );
          return;
        }

        saveResult.then(() => {
          addMessage(
            tct('Restored [fieldName] from [oldValue] to [newValue]', {
              fieldName: <strong>{label}</strong>,
              oldValue: <FormValue>{prettyFormString(oldValue)}</FormValue>,
              newValue: <FormValue>{prettyFormString(newValue)}</FormValue>,
            }),
            'undo',
            {
              duration: DEFAULT_TOAST_DURATION,
            }
          );
        });
      },
    }
  );
}

const FormValue = styled('span')`
  font-style: italic;
`;
