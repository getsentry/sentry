import {useCallback, useContext, useEffect, useState, useSyncExternalStore} from 'react';

import FormContext from 'sentry/components/forms/formContext';
import type FormModel from 'sentry/components/forms/model';
import {MockModel} from 'sentry/components/forms/model';
import type {FieldValue} from 'sentry/components/forms/types';

export function useFormFields() {
  const context = useContext(FormContext);
  const [model] = useState<FormModel>(() => context.form ?? (new MockModel({}) as any));
  const [_, forceUpdate] = useState({});
  useEffect(() => {
    const prevHook = model.options.onFieldChange;
    model.setFormOptions({
      onFieldChange: (id, value) => {
        forceUpdate({});
        prevHook?.(id, value);
      },
    });
  }, [model]);

  return model.getData();
}

export function useFormField<Value extends FieldValue = FieldValue>(
  field: string
): Value | undefined {
  const context = useContext(FormContext);

  const subscribe = useCallback(
    (callback: () => void) => {
      const prevHook = context.form?.options.onFieldChange;
      context.form?.setFormOptions({
        onFieldChange: (id, newValue) => {
          if (id === field) {
            callback();
          }
          prevHook?.(id, newValue);
        },
      });

      // Return cleanup function (though form models don't typically need cleanup)
      return () => {
        // Reset to previous hook if needed
        context.form?.setFormOptions({
          onFieldChange: prevHook,
        });
      };
    },
    [context.form, field]
  );

  const getSnapshot = useCallback(() => {
    return context.form?.getValue(field) as Value;
  }, [context.form, field]);

  return useSyncExternalStore(subscribe, getSnapshot);
}
