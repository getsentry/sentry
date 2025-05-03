import {useContext, useEffect, useState} from 'react';

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

export function useFormField<Value extends FieldValue = FieldValue>(field: string) {
  const context = useContext(FormContext);
  const [model] = useState<FormModel>(() => context.form ?? (new MockModel({}) as any));
  const [value, setValue] = useState<Value | undefined>(() => model.getValue(field));
  useEffect(() => {
    const prevHook = model.options.onFieldChange;
    model.setFormOptions({
      onFieldChange: (id, newValue) => {
        if (id === field) {
          setValue(newValue as Value);
        }
        prevHook?.(id, newValue);
      },
    });
  }, [model, field]);

  return value;
}
