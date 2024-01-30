import {Banner} from 'sentry/components/events/aiAutofix/banner';
import {FixResult} from 'sentry/components/events/aiAutofix/fixResult';
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
        <FixResult autofixData={autofixData} onRetry={triggerAutofix} />
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
