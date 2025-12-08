import {useContext, useEffect} from 'react';
import {autorun} from 'mobx';

import FormContext from 'sentry/components/forms/formContext';
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

  // Use autorun for form reactivity and useEffect for builder state changes
  useEffect(() => {
    if (form === undefined || hasSetAutomationName) {
      return () => {};
    }

    // Don't auto-generate name if we're editing an existing automation
    if (automation) {
      return () => {};
    }

    return autorun(() => {
      const generatedName = getAutomationName(builderState);
      if (generatedName) {
        form.setValue('name', generatedName);
      }
    });
  }, [form, hasSetAutomationName, automation, builderState]);
}
