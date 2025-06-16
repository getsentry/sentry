import {useContext, useEffect, useState} from 'react';

import FormContext from 'sentry/components/forms/formContext';

export function useFormFields() {
  const context = useContext(FormContext);
  const [_, forceUpdate] = useState({});

  useEffect(() => {
    const model = context.form;
    if (!model) {
      return;
    }

    const prevHook = model.options.onFieldChange;
    model.setFormOptions({
      onFieldChange: (id, value) => {
        forceUpdate({});
        prevHook?.(id, value);
      },
    });
  }, [context.form]);

  if (!context.form) {
    return {};
  }

  return context.form.getData();
}
