import {useCallback, useEffect, useRef} from 'react';

import type FormModel from 'sentry/components/forms/model';

/**
 * Hook that enables eager form validation — validates the entire form on
 * any field blur (via event bubbling) and on the first meaningful field change.
 * This surfaces sibling field errors early rather than waiting until submit.
 *
 * Returns `onBlur` and `onFieldChange` callbacks to pass to `<Form>`.
 */
export function useFormEagerValidation(formModel: FormModel) {
  // Track whether initialization is complete to avoid validating during setup
  const isInitialized = useRef(false);
  // Track whether we've done an initial full validation
  const hasValidatedOnce = useRef(false);

  useEffect(() => {
    // Mark initialization complete after first render cycle
    isInitialized.current = true;
  }, []);

  // Validate entire form when any field loses focus (via event bubbling)
  const onBlur = useCallback(() => {
    if (!isInitialized.current) {
      return;
    }
    formModel.validateForm();
  }, [formModel]);

  // On first meaningful field change, validate entire form to surface sibling errors
  const onFieldChange = useCallback(() => {
    if (!isInitialized.current || hasValidatedOnce.current) {
      return;
    }
    hasValidatedOnce.current = true;
    formModel.validateForm();
  }, [formModel]);

  return {onBlur, onFieldChange};
}
