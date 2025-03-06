import {isValidElement} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import type {FieldValue} from 'sentry/components/forms/model';
import type FormModel from 'sentry/components/forms/model';
import {DEFAULT_TOAST_DURATION} from 'sentry/constants';
import {t, tct} from 'sentry/locale';
import IndicatorStore from 'sentry/stores/indicatorStore';
import {space} from 'sentry/styles/space';
import {isDemoModeEnabled} from 'sentry/utils/demoMode';

type IndicatorType = 'loading' | 'error' | 'success' | 'undo' | '';

type Options = {
  append?: boolean;
  disableDismiss?: boolean;
  duration?: number | null;
  modelArg?: {
    id: string;
    model: FormModel;
    undo: () => void;
  };
  undo?: () => void;
};

export type Indicator = {
  id: string | number;
  message: React.ReactNode;
  options: Options;
  type: IndicatorType;
  clearId?: null | number;
};

// Removes a single indicator
export function removeIndicator(indicator: Indicator) {
  IndicatorStore.remove(indicator);
}

// Clears all indicators
export function clearIndicators() {
  IndicatorStore.clear();
}

// Note previous IndicatorStore.add behavior was to default to "loading" if no type was supplied
export function addMessage(
  msg: React.ReactNode,
  type: IndicatorType,
  options: Options = {}
): void {
  const {duration: optionsDuration, append, ...rest} = options;

  // XXX: Debug for https://sentry.io/organizations/sentry/issues/1595204979/
  if (
    typeof (msg as any)?.message !== 'undefined' &&
    typeof (msg as any)?.code !== 'undefined' &&
    typeof (msg as any)?.extra !== 'undefined'
  ) {
    Sentry.captureException(new Error('Attempt to XHR response to Indicators'));
  }

  // use default only if undefined, as 0 is a valid duration
  const duration =
    typeof optionsDuration === 'undefined' ? DEFAULT_TOAST_DURATION : optionsDuration;

  const action = append ? 'append' : 'add';
  // XXX: This differs from `IndicatorStore.add` since it won't return the indicator that is created
  // because we are firing an action. You can just add a new message and it will, by default,
  // replace active indicator
  IndicatorStore[action](msg, type, {...rest, duration});
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
  if (isDemoModeEnabled()) {
    return addMessageWithType('error')(
      t('This action is not allowed in demo mode.'),
      options
    );
  }
  if (typeof msg === 'string' || isValidElement(msg)) {
    return addMessageWithType('error')(msg, options);
  }
  // When non string, non-react element responses are passed, addErrorMessage
  // crashes the entire page because it falls outside any error
  // boundaries defined for the components on the page. Adding a fallback
  // to prevent page crashes.
  return addMessageWithType('error')(
    t(
      "You've hit an issue, fortunately we use Sentry to monitor Sentry. So it's likely we're already looking into this!"
    ),
    options
  );
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
const prettyFormString = (val: ChangeValue, model: FormModel, fieldName: string) => {
  const descriptor = model.fieldDescriptor.get(fieldName);

  if (descriptor && typeof descriptor.formatMessageValue === 'function') {
    const initialData = model.initialData;
    // XXX(epurkhiser): We pass the "props" as the descriptor and initialData.
    // This isn't necessarily all of the props of the form field, but should
    // make up a good portion needed for formatting.
    return descriptor.formatMessageValue(val, {...descriptor, initialData});
  }

  if (PRETTY_VALUES.has(val)) {
    return PRETTY_VALUES.get(val);
  }

  return typeof val === 'object' ? val : String(val);
};

// Some fields have objects in them.
// For example project key rate limits.
type ChangeValue = FieldValue | Record<string, any>;

type Change = {
  new: ChangeValue;
  old: ChangeValue;
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

  const prettifyValue = (val: ChangeValue) => prettyFormString(val, model, fieldName);

  // Hide the change text when formatMessageValue is explicitly set to false
  const showChangeText = model.getDescriptor(fieldName, 'formatMessageValue') !== false;

  const tctArgsSuccess = {
    root: <MessageContainer />,
    fieldName: <FieldName>{label}</FieldName>,
    oldValue: <FormValue>{prettifyValue(change.old)}</FormValue>,
    newValue: <FormValue>{prettifyValue(change.new)}</FormValue>,
  };

  addSuccessMessage(
    showChangeText
      ? tct('Changed [fieldName] from [oldValue] to [newValue]', tctArgsSuccess)
      : tct('Changed [fieldName]', tctArgsSuccess),
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

          const tctArgsFail = {
            root: <MessageContainer />,
            fieldName: <FieldName>{label}</FieldName>,
            oldValue: <FormValue>{prettifyValue(oldValue)}</FormValue>,
            newValue: <FormValue>{prettifyValue(newValue)}</FormValue>,
          };

          if (!saveResult) {
            addErrorMessage(
              showChangeText
                ? tct(
                    'Unable to restore [fieldName] from [oldValue] to [newValue]',
                    tctArgsFail
                  )
                : tct('Unable to restore [fieldName]', tctArgsFail)
            );
            return;
          }

          const tctArgsRestored = {
            root: <MessageContainer />,
            fieldName: <FieldName>{label}</FieldName>,
            oldValue: <FormValue>{prettifyValue(oldValue)}</FormValue>,
            newValue: <FormValue>{prettifyValue(newValue)}</FormValue>,
          };

          saveResult.then(() => {
            addMessage(
              showChangeText
                ? tct(
                    'Restored [fieldName] from [oldValue] to [newValue]',
                    tctArgsRestored
                  )
                : tct('Restored [fieldName]', tctArgsRestored),
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
  font-weight: ${p => p.theme.fontWeightBold};
  margin: 0 ${space(0.5)};
`;
const MessageContainer = styled('div')`
  display: flex;
  align-items: center;
`;
