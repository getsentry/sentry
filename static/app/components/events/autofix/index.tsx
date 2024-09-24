import ErrorBoundary from 'sentry/components/errorBoundary';
import {AutofixBanner} from 'sentry/components/events/autofix/autofixBanner';
import type {GroupWithAutofix} from 'sentry/components/events/autofix/types';
import {useAutofixSetup} from 'sentry/components/events/autofix/useAutofixSetup';
import type {Event} from 'sentry/types/event';

interface Props {
  event: Event;
  group: GroupWithAutofix;
}

export function Autofix({event, group}: Props) {
  const {canStartAutofix} = useAutofixSetup({
    groupId: group.id,
  });

  return (
    <ErrorBoundary mini>
      <AutofixBanner
        group={group}
        project={group.project}
        event={event}
        hasSuccessfulSetup={canStartAutofix}
      />
    </ErrorBoundary>
  );
}
