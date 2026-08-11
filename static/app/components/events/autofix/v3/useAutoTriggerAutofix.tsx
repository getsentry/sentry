import {useEffect, useRef} from 'react';

import {useExplorerAutofix} from 'sentry/components/events/autofix/useExplorerAutofix';
import type {Group} from 'sentry/types/group';

interface UseAutoTriggerAutofixOptions {
  autofix: ReturnType<typeof useExplorerAutofix>;
  group: Group;
}

export function useAutoTriggerAutofix({autofix, group}: UseAutoTriggerAutofixOptions) {
  const alreadyTriggered = useRef(false);

  // Extract startStep so we don't depend on `autofix`, which is unstable.
  const startStep = autofix.startStep;

  useEffect(() => {
    if (alreadyTriggered.current || autofix.isLoading || autofix.runState) {
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
    startStep('root_cause');
  }, [
    autofix.isLoading,
    autofix.runState,
    group.seerAutofixLastTriggered,
    group.seerExplorerAutofixLastTriggered,
    startStep,
  ]);
}
