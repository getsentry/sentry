import {AutofixCard} from 'sentry/components/events/aiAutofix/autofixCard';
import {Banner} from 'sentry/components/events/aiAutofix/banner';
import {useAiAutofix} from 'sentry/components/events/aiAutofix/useAiAutofix';
import type {Group} from 'sentry/types';

type Props = {
  group: Group;
};

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
