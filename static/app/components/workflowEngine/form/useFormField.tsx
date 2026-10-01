import {useCallback, useContext, useSyncExternalStore} from 'react';
import noop from 'lodash/noop';
import {observe} from 'mobx';

import {FormContext} from 'sentry/components/forms/formContext';
import type {FieldValue} from 'sentry/components/forms/types';
import {getFormFieldValue} from 'sentry/components/workflowEngine/form/getFormFieldValue';

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
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

      return observe(form.fields, change => {
        if (change.name === field) {
          callback();
        }
      });
    },
    [context.form, field]
  );

  const getSnapshot = useCallback(() => {
    if (!context.form) {
      return;
    }

    return getFormFieldValue<Value>(context.form, field);
  }, [context.form, field]);

  return useSyncExternalStore(subscribe, getSnapshot);
}
