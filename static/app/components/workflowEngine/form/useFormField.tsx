import {useCallback, useContext, useSyncExternalStore} from 'react';
import noop from 'lodash/noop';
import {observe} from 'mobx';

import FormContext from 'sentry/components/forms/formContext';
import type {FieldValue} from 'sentry/components/forms/types';

export function useFormField<Value extends FieldValue = FieldValue>(
  field: string
): Value | undefined {
  const context = useContext(FormContext);

  const subscribe = useCallback(
    (callback: () => void) => {
      const form = context.form;
      if (!form) {
        return noop;
      }

      // Check if the field exists
      if (!form?.fields.has(field)) {
        console.log('field not found', field);
        // Allow field to be created later by subscribing to all fields
        return observe(form.fields, () => {
          // Only call callback if our specific field now exists
          // This is less efficient than observing the specific field
          if (form.fields.has(field)) {
            callback();
          }
        });
      }

      // Use MobX observe for specific field watching
      const dispose = observe(form.fields, field, callback);

      return dispose;
    },
    [context.form, field]
  );

  const getSnapshot = useCallback(() => {
    if (!context.form) {
      return undefined;
    }

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    return context.form.getValue(field) as Value;
  }, [context.form, field]);

  return useSyncExternalStore(subscribe, getSnapshot);
}
