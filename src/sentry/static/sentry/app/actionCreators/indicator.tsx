import React from 'react';
import styled from '@emotion/styled';

import {DEFAULT_TOAST_DURATION} from 'app/constants';
import {t, tct} from 'app/locale';
import FormModel, {FieldValue} from 'app/views/settings/components/forms/model';
import IndicatorActions from 'app/actions/indicatorActions';
import space from 'app/styles/space';

type IndicatorType = 'loading' | 'error' | 'success' | 'undo' | '';

type Options = {
  duration?: number;
  append?: boolean;
  modelArg?: {
    model: FormModel;
    id: string;
    undo: () => void;
  };
};

type Indicator = {
  type: IndicatorType;
  id: string | number;
  message: React.ReactNode;
  options: Options;
};

// Removes a single indicator
export function removeIndicator(indicator: Indicator) {
  IndicatorActions.remove(indicator);
}

// Clears all indicators
export function clearIndicators() {
  IndicatorActions.clear();
}

// Note previous IndicatorStore.add behavior was to default to "loading" if no type was supplied
export function addMessage(
  msg: React.ReactNode,
  type: IndicatorType,
  options: Options = {}
): void {
  const {duration: optionsDuration, append, ...rest} = options;

  // use default only if undefined, as 0 is a valid duration
  const duration =
    typeof optionsDuration === 'undefined' ? DEFAULT_TOAST_DURATION : optionsDuration;

  const action = append ? 'append' : 'replace';
  // XXX: This differs from `IndicatorStore.add` since it won't return the indicator that is created
  // because we are firing an action. You can just add a new message and it will, by default,
  // replace active indicator
  IndicatorActions[action](msg, type, {...rest, duration});
}

function addMessageWithType(type: IndicatorType) {
  return (msg: React.ReactNode, options?: Options) => addMessage(msg, type, options);
}

export function addLoadingMessage(
  msg: React.ReactNode = t('Saving changes...'),
  options?: Options
) {
  return addMessageWithType('loading')(msg, options);
}

export function addErrorMessage(msg: React.ReactNode, options?: Options) {
  return addMessageWithType('error')(msg, options);
}

export function addSuccessMessage(msg: React.ReactNode, options?: Options) {
  return addMessageWithType('success')(msg, options);
}

const PRETTY_VALUES: Map<unknown, string> = new Map([
  ['', '<empty>'],
  [null, '<none>'],
  [undefined, '<unset>'],
  // if we don't cast as any, then typescript complains because booleans are not valid keys
  [true as any, 'enabled'],
  [false as any, 'disabled'],
]);

// Transform form values into a string
// Otherwise bool values will not get rendered and empty strings look like a bug
const prettyFormString = (val: FieldValue, model: FormModel, fieldName: string) => {
  const descriptor = model.fieldDescriptor.get(fieldName);

  if (descriptor && typeof descriptor.formatMessageValue === 'function') {
    const initialData = model.initialData;
    // XXX(epurkhsier): We pass the "props" as the descriptor and initialData.
    // This isn't necessarily all of the props of the form field, but should
    // make up a good portion needed for formatting.
    return descriptor.formatMessageValue(val, {...descriptor, initialData});
  }

  if (PRETTY_VALUES.has(val)) {
    return PRETTY_VALUES.get(val);
  }

  return `${val}`;
};

type Change = {
  old: FieldValue;
  new: FieldValue;
};

/**
 * This will call an action creator to generate a "Toast" message that
 * notifies user the field that changed with its previous and current values.
 *
 * Also allows for undo
 */

export function saveOnBlurUndoMessage(
  change: Change,
  model: FormModel,
  fieldName: string
) {
  if (!model) {
    return;
  }

  const label = model.getDescriptor(fieldName, 'label');

  if (!label) {
    return;
  }

  const prettifyValue = (val: FieldValue) => prettyFormString(val, model, fieldName);

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
    {
      modelArg: {
        model,
        id: fieldName,
        undo: () => {
          if (!model || !fieldName) {
            return;
          }

          const oldValue = model.getValue(fieldName);
          const didUndo = model.undo();
          const newValue = model.getValue(fieldName);

          if (!didUndo) {
            return;
          }
          if (!label) {
            return;
          }

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
