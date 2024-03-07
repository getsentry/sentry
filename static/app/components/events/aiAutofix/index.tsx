import {AutofixBanner} from 'sentry/components/events/aiAutofix/autofixBanner';
import {AutofixCard} from 'sentry/components/events/aiAutofix/autofixCard';
import type {GroupWithAutofix} from 'sentry/components/events/aiAutofix/types';
import {useAiAutofix} from 'sentry/components/events/aiAutofix/useAiAutofix';
import type {Event} from 'sentry/types';

interface Props {
  event: Event;
  group: GroupWithAutofix;
}

export function AiAutofix({event, group}: Props) {
  const {autofixData, triggerAutofix, reset} = useAiAutofix(group, event);

  return (
    <div>
      {autofixData ? (
        <AutofixCard data={autofixData} onRetry={reset} />
      ) : (
        <AutofixBanner triggerAutofix={triggerAutofix} />
      )}
    </div>
  );
}
