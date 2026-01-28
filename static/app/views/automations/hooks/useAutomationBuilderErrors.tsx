import {useCallback, useState} from 'react';

/**
 * Hook to manage automation builder validation errors state.
 * Returns the errors state, setter, and a helper to remove individual errors.
 */
export function useAutomationBuilderErrors() {
  const [errors, setErrors] = useState<Record<string, any>>({});

  const removeError = useCallback((errorId: string) => {
    setErrors(prev => {
      const {[errorId]: _removedError, ...remainingErrors} = prev;
      return remainingErrors;
    });
  }, []);

  return {errors, setErrors, removeError};
}
