import styled from '@emotion/styled';

import {
  addErrorMessage,
  addMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import type FormModel from 'sentry/components/forms/model';
import type {FieldValue} from 'sentry/components/forms/model';
import {DEFAULT_TOAST_DURATION} from 'sentry/constants';
import {tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';

/**
 * This will call an action creator to generate a "Toast" message that
 * notifies user the field that changed with its previous and current values.
 *
 * Also allows for undo
 */
export function addUndoableFormChangeMessage(
  change: {
    new: FieldValue | Record<string, any>;
    old: FieldValue | Record<string, any>;
  },
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

  const prettifyValue = (val: FieldValue | Record<string, any>) =>
    prettyFormString(val, model, fieldName);

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
      formModel: {
        model,
        id: fieldName,
      },
      undo: () => {
        if (!model || !fieldName) {
          return;
        }

        const oldValue = model.getValue(fieldName);
        if (!model.undo()) {
          // Failed to undo, do nothing.
          return;
        }

        const newValue = model.getValue(fieldName);
        const maybeSaveResultPromise = model.saveField(fieldName, newValue);

        if (!maybeSaveResultPromise) {
          const tctArgsFail = {
            root: <MessageContainer />,
            fieldName: <FieldName>{label}</FieldName>,
            oldValue: <FormValue>{prettifyValue(oldValue)}</FormValue>,
            newValue: <FormValue>{prettifyValue(newValue)}</FormValue>,
          };

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

        maybeSaveResultPromise.then(() => {
          addMessage(
            showChangeText
              ? tct('Restored [fieldName] from [oldValue] to [newValue]', tctArgsRestored)
              : tct('Restored [fieldName]', tctArgsRestored),
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
const prettyFormString = (
  val: FieldValue | Record<string, any>,
  model: FormModel,
  fieldName: string
) => {
  const descriptor = model.fieldDescriptor.get(fieldName);

  if (descriptor && typeof descriptor.formatMessageValue === 'function') {
    // XXX(epurkhiser): We pass the "props" as the descriptor and initialData.
    // This isn't necessarily all of the props of the form field, but should
    // make up a good portion needed for formatting.
    return descriptor.formatMessageValue(val, {
      ...descriptor,
      initialData: model.initialData,
    });
  }

  if (PRETTY_VALUES.has(val)) {
    return PRETTY_VALUES.get(val);
  }

  return typeof val === 'object' ? val : String(val);
};

const FormValue = styled('em')`
  margin: 0 ${space(0.5)};
`;
const FieldName = styled('span')`
  font-weight: ${p => p.theme.fontWeight.bold};
  margin: 0 ${space(0.5)};
`;
const MessageContainer = styled('div')`
  display: flex;
  align-items: center;
`;
