import {createContext, useContext, useMemo, useState, type ReactNode} from 'react';

import type {AutofixExplorerStep} from 'sentry/components/events/autofix/useExplorerAutofix';

type RetryStepContextValue = {
  clearRequest: () => void;
  requestRetry: (step: AutofixExplorerStep) => void;
  requestedStep: AutofixExplorerStep | null;
};

const RetryStepContext = createContext<RetryStepContextValue | null>(null);

/**
 * Lets something outside a step's card — a drawer-level banner, say — ask that
 * card to open its retry prompt, instead of silently re-running the step.
 *
 * The request is a one-shot signal: the card that owns the step opens and
 * scrolls to its retry prompt, then clears the request so the user's own
 * dismissal sticks.
 */
export function RetryStepProvider({children}: {children: ReactNode}) {
  const [requestedStep, setRequestedStep] = useState<AutofixExplorerStep | null>(null);

  const value = useMemo(
    () => ({
      requestedStep,
      requestRetry: setRequestedStep,
      clearRequest: () => setRequestedStep(null),
    }),
    [requestedStep]
  );

  return <RetryStepContext value={value}>{children}</RetryStepContext>;
}

/**
 * Null outside a provider, so cards and banners rendered on their own (stories,
 * tests) keep working without one.
 */
export function useRetryStep() {
  return useContext(RetryStepContext);
}
