import ErrorBoundary from 'sentry/components/errorBoundary';
import {AutofixBanner} from 'sentry/components/events/autofix/autofixBanner';
import {AutofixCard} from 'sentry/components/events/autofix/autofixCard';
import type {GroupWithAutofix} from 'sentry/components/events/autofix/types';
import {useAiAutofix} from 'sentry/components/events/autofix/useAutofix';
import {useAutofixSetup} from 'sentry/components/events/autofix/useAutofixSetup';
import type {Event} from 'sentry/types/event';
import useRouteAnalyticsParams from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';

interface Props {
  event: Event;
  group: GroupWithAutofix;
}

export function Autofix({event, group}: Props) {
  const {autofixData, triggerAutofix, reset} = useAiAutofix(group, event);

  const {hasSuccessfulSetup} = useAutofixSetup({
    groupId: group.id,
  });

  useRouteAnalyticsParams({
    autofix_status: autofixData?.status ?? 'none',
  });

  return (
    <ErrorBoundary mini>
      <div>
        {autofixData ? (
          <AutofixCard data={autofixData} onRetry={reset} groupId={group.id} />
        ) : (
          <AutofixBanner
            groupId={group.id}
            projectId={group.project.id}
            triggerAutofix={triggerAutofix}
            hasSuccessfulSetup={hasSuccessfulSetup}
          />
        )}
      </div>
    </ErrorBoundary>
  );
}
