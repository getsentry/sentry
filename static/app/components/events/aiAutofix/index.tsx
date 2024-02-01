import {AutofixCard} from 'sentry/components/events/aiAutofix/autofixCard';
import {Banner} from 'sentry/components/events/aiAutofix/banner';
import type {GroupWithAutofix} from 'sentry/components/events/aiAutofix/types';
import {useAiAutofix} from 'sentry/components/events/aiAutofix/useAiAutofix';

interface Props {
  group: GroupWithAutofix;
}

export function AiAutofix({group}: Props) {
  const {autofixData, triggerAutofix, additionalContext, setAdditionalContext} =
    useAiAutofix(group);

  return (
    <div>
      {autofixData ? (
        <AutofixCard data={autofixData} onRetry={triggerAutofix} />
      ) : (
        <Banner
          onButtonClick={triggerAutofix}
          additionalContext={additionalContext}
          setAdditionalContext={setAdditionalContext}
        />
      )}
    </div>
  );
}
