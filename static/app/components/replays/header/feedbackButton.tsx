import {Fragment} from 'react';

import {FeatureFeedback} from 'sentry/components/featureFeedback';
import HookOrDefault from 'sentry/components/hookOrDefault';

const FeedbackButtonHook = HookOrDefault({
  hookName: 'component:replay-feedback-button',
  defaultComponent: ({children}) => <Fragment>{children}</Fragment>,
});

function FeedbackButton() {
  return (
    <FeedbackButtonHook>
      <FeatureFeedback featureName="replay" buttonProps={{size: 'sm'}} />
    </FeedbackButtonHook>
  );
}

export default FeedbackButton;
