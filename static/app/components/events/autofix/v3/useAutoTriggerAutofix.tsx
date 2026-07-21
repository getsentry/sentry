import {useEffect, useRef} from 'react';

import {useExplorerAutofix} from 'sentry/components/events/autofix/useExplorerAutofix';
import type {Group} from 'sentry/types/group';
import {RequestError} from 'sentry/utils/requestError/requestError';

interface UseAutoTriggerAutofixOptions {
  autofix: ReturnType<typeof useExplorerAutofix>;
  group: Group;
}

export function useAutoTriggerAutofix({autofix, group}: UseAutoTriggerAutofixOptions) {
  const alreadyTriggered = useRef(false);

  // extract startStep and reset first here so we can depend on them directly as `autofix` itself is unstable.
  const startStep = autofix.startStep;
  const reset = autofix.reset;

  useEffect(() => {
    if (alreadyTriggered.current) {
      return;
    }

    // In order to have a smooth transition from legacy to explorer autofix, we want to automatically
    // trigger autofix when users view an issue that had legacy but not explorer autofix.
    const shouldAutotriggerAutofix =
      !!group.seerAutofixLastTriggered && !group.seerExplorerAutofixLastTriggered;

    if (!shouldAutotriggerAutofix) {
      return;
    }

    alreadyTriggered.current = true;
    startStep('root_cause').catch((error: unknown) => {
      // If the org has exhausted its Seer quota (402), silently reset
      // so the user sees the normal start card instead of an error.
      if (error instanceof RequestError && error.status === 402) {
        reset();
      }
      // For all errors: startStep already sets error state in the query cache
      // before re-throwing, so we just need to catch here to prevent unhandled
      // promise rejections from this auto-triggered (non-user-initiated) call.
    });
  }, [group, startStep, reset]);
}
