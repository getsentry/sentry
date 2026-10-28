import {useContext, useEffect} from 'react';

import {FormContext} from 'sentry/components/forms/formContext';
import {useAutomationBuilderContext} from 'sentry/views/automations/components/automationBuilderContext';
import {getAutomationName} from 'sentry/views/automations/components/forms/automationNameUtils';
import {useAutomationFormContext} from 'sentry/views/automations/components/forms/context';

/**
 * Hook to automatically set the automation name based on automation builder state.
 */
export function useSetAutomaticAutomationName() {
  const {form} = useContext(FormContext);
  const {hasSetAutomationName, automation} = useAutomationFormContext();
  const {state: builderState} = useAutomationBuilderContext();

  useEffect(() => {
    // Don't auto-generate name if we're editing an existing automation
    if (form === undefined || hasSetAutomationName || automation) {
      return;
    }

    const generatedName = getAutomationName(builderState);
    if (generatedName) {
      form.setValue('name', generatedName);
    }
  }, [form, hasSetAutomationName, automation, builderState]);
}
