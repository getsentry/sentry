import ErrorBoundary from 'sentry/components/errorBoundary';
import {AutofixBanner} from 'sentry/components/events/autofix/autofixBanner';
import {AutofixCard} from 'sentry/components/events/autofix/autofixCard';
import type {GroupWithAutofix} from 'sentry/components/events/autofix/types';
import {useAiAutofix} from 'sentry/components/events/autofix/useAutofix';
import {useAutofixSetup} from 'sentry/components/events/autofix/useAutofixSetup';
import type {Event} from 'sentry/types/event';

interface Props {
  event: Event;
  group: GroupWithAutofix;
}

export function Autofix({event, group}: Props) {
  const {autofixData, triggerAutofix, reset} = useAiAutofix(group, event);

  const {hasSuccessfulSetup} = useAutofixSetup({
    groupId: group.id,
  });

  return (
    <ErrorBoundary mini>
      <div>
        {autofixData ? (
          <AutofixCard data={autofixData} onRetry={reset} groupId={group.id} />
        ) : (
          <AutofixBanner
            groupId={group.id}
            triggerAutofix={triggerAutofix}
            hasSuccessfulSetup={hasSuccessfulSetup}
          />
        )}
      </div>
    </ErrorBoundary>
  );
}
