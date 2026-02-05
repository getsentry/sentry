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
  // Track pending blur validation timeout so it can be cancelled
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Mark initialization complete after first render cycle
    isInitialized.current = true;
    return () => {
      if (blurTimeoutRef.current !== null) {
        clearTimeout(blurTimeoutRef.current);
      }
    };
  }, []);

  // Validate entire form when any field loses focus (via event bubbling).
  // Deferred to allow the browser to finish processing the focus change and any
  // pending input events before triggering MobX re-renders, which would
  // otherwise re-set controlled input values before clear() completes.
  // Skipped if the form is currently saving (e.g. after submit) to avoid
  // overwriting server-set validation errors.
  const onBlur = useCallback(() => {
    if (!isInitialized.current) {
      return;
    }
    if (blurTimeoutRef.current !== null) {
      clearTimeout(blurTimeoutRef.current);
    }
    blurTimeoutRef.current = setTimeout(() => {
      blurTimeoutRef.current = null;
      // Skip if the form is saving or already has errors (e.g. from server
      // response) to avoid overwriting server-set validation errors
      if (!formModel.isSaving && !formModel.isError) {
        formModel.validateForm();
      }
    }, 0);
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
