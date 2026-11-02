import type {ReactNode} from 'react';

import {Container} from '@sentry/scraps/layout';

import {SeerOutOfCreditsCta} from 'sentry/components/seer/outOfCredits/seerOutOfCreditsCta';
import {defined} from 'sentry/utils/defined';
import {
  useSeerCreditCheck,
  type SeerCreditOperation,
} from 'sentry/utils/seer/useSeerCreditCheck';

import type {AutofixNextStep} from './getAutofixNextStep';

type AutofixAction = AutofixNextStep['action'];

const AUTOFIX_CREDIT_OPERATIONS: Record<AutofixAction, SeerCreditOperation> = {
  root_cause: 'autofix_root_cause',
  solution: 'autofix_solution',
  code_changes: 'autofix_code_changes',
  create_pr: 'autofix_create_pr',
  pr_iteration: 'autofix_pr_iteration',
};

/**
 * Whether the organization can afford the autofix action a surface is about to
 * offer. Without an action nothing is offered, so nothing is checked.
 */
export function useAutofixCreditCheck(
  action: AutofixAction | null | undefined,
  {enabled = true}: {enabled?: boolean} = {}
) {
  return useSeerCreditCheck(AUTOFIX_CREDIT_OPERATIONS[action ?? 'root_cause'], {
    enabled: enabled && defined(action),
  });
}

/**
 * Stands in for an autofix trigger the organization can't afford. getsentry
 * supplies the CTA; open source renders nothing.
 */
export function AutofixOutOfCreditsCta() {
  return (
    <Container data-test-id="autofix-out-of-credits-cta">
      <SeerOutOfCreditsCta />
    </Container>
  );
}

interface AutofixCreditGateProps {
  action: AutofixAction;
  children: ReactNode;
}

/**
 * Renders an autofix trigger only when the organization can afford it, and the
 * out-of-credits CTA in its place otherwise. Renders nothing while checking so
 * the trigger never flashes up before being swapped out.
 */
export function AutofixCreditGate({action, children}: AutofixCreditGateProps) {
  const {hasEnoughCredits, isPending} = useAutofixCreditCheck(action);

  if (isPending) {
    return null;
  }

  if (!hasEnoughCredits) {
    return <AutofixOutOfCreditsCta />;
  }

  return children;
}
