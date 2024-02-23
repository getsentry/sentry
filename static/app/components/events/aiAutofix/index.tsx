import {AutofixBanner} from 'sentry/components/events/aiAutofix/autofixBanner';
import {AutofixCard} from 'sentry/components/events/aiAutofix/autofixCard';
import type {GroupWithAutofix} from 'sentry/components/events/aiAutofix/types';
import {useAiAutofix} from 'sentry/components/events/aiAutofix/useAiAutofix';

interface Props {
  group: GroupWithAutofix;
}

export function AiAutofix({group}: Props) {
  const {autofixData, triggerAutofix, reset} = useAiAutofix(group);

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
