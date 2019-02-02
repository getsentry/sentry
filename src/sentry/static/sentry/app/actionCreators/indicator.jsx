import React from 'react';
import styled from 'react-emotion';

import {DEFAULT_TOAST_DURATION} from 'app/constants';
import {t, tct} from 'app/locale';
import IndicatorActions from 'app/actions/indicatorActions';
import space from 'app/styles/space';

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

  const action = options.append ? 'append' : 'replace';
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

const PRETTY_VALUES = {
  '': '<empty>',
  [null]: '<none>',
  [undefined]: '<unset>',
  [false]: 'disabled',
  [true]: 'enabled',
};

// Transform form values into a string
// Otherwise bool values will not get rendered and empty strings look like a bug
const prettyFormString = (val, model, fieldName) => {
  const descriptor = model.fieldDescriptor.get(fieldName);

  if (descriptor && typeof descriptor.formatMessageValue === 'function') {
    const initialData = model.initialData;
    // XXX(epurkhsier): We pass the "props" as the descriptor and initialData.
    // This isn't necessarily all of the props of the form field, but should
    // make up a good portion needed for formatting.
    return descriptor.formatMessageValue(val, {...descriptor, initialData});
  }

  if (val in PRETTY_VALUES) {
    return PRETTY_VALUES[val];
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

  const label = model.getDescriptor(fieldName, 'label');

  if (!label) return;

  const prettifyValue = val => prettyFormString(val, model, fieldName);

  // Hide the change text when formatMessageValue is explicitly set to false
  const showChangeText = model.getDescriptor(fieldName, 'formatMessageValue') !== false;

  addSuccessMessage(
    tct(
      showChangeText
        ? 'Changed [fieldName] from [oldValue] to [newValue]'
        : 'Changed [fieldName]',
      {
        root: <MessageContainer />,
        fieldName: <FieldName>{label}</FieldName>,
        oldValue: <FormValue>{prettifyValue(change.old)}</FormValue>,
        newValue: <FormValue>{prettifyValue(change.new)}</FormValue>,
      }
    ),
    DEFAULT_TOAST_DURATION,
    {
      model,
      id: fieldName,
      undo: () => {
        if (!model || !fieldName) return;

        const oldValue = model.getValue(fieldName);
        const didUndo = model.undo();
        const newValue = model.getValue(fieldName);

        if (!didUndo) return;
        if (!label) return;

        // `saveField` can return null if it can't save
        const saveResult = model.saveField(fieldName, newValue);

        if (!saveResult) {
          addErrorMessage(
            tct(
              showChangeText
                ? 'Unable to restore [fieldName] from [oldValue] to [newValue]'
                : 'Unable to restore [fieldName]',
              {
                root: <MessageContainer />,
                fieldName: <FieldName>{label}</FieldName>,
                oldValue: <FormValue>{prettifyValue(oldValue)}</FormValue>,
                newValue: <FormValue>{prettifyValue(newValue)}</FormValue>,
              }
            )
          );
          return;
        }

        saveResult.then(() => {
          addMessage(
            tct(
              showChangeText
                ? 'Restored [fieldName] from [oldValue] to [newValue]'
                : 'Restored [fieldName]',
              {
                root: <MessageContainer />,
                fieldName: <FieldName>{label}</FieldName>,
                oldValue: <FormValue>{prettifyValue(oldValue)}</FormValue>,
                newValue: <FormValue>{prettifyValue(newValue)}</FormValue>,
              }
            ),
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
  margin: 0 ${space(0.5)};
`;
const FieldName = styled('span')`
  font-weight: bold;
  margin: 0 ${space(0.5)};
`;
const MessageContainer = styled('div')`
  display: flex;
  align-items: center;
`;
