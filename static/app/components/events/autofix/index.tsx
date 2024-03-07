import ErrorBoundary from 'sentry/components/errorBoundary';
import {AutofixBanner} from 'sentry/components/events/autofix/autofixBanner';
import {AutofixCard} from 'sentry/components/events/autofix/autofixCard';
import type {GroupWithAutofix} from 'sentry/components/events/autofix/types';
import {useAiAutofix} from 'sentry/components/events/autofix/useAutofix';
import type {Event} from 'sentry/types';

interface Props {
  event: Event;
  group: GroupWithAutofix;
}

export function Autofix({event, group}: Props) {
  const {autofixData, triggerAutofix, reset} = useAiAutofix(group, event);

  return (
    <ErrorBoundary mini>
      <div>
        {autofixData ? (
          <AutofixCard data={autofixData} onRetry={reset} />
        ) : (
          <AutofixBanner triggerAutofix={triggerAutofix} />
        )}
      </div>
    </ErrorBoundary>
  );
}
