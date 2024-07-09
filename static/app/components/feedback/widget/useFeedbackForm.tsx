import {useCallback} from 'react';

import {
  useFeedback,
  type UseFeedbackOptions,
} from 'sentry/components/feedback/widget/useFeedback';

export function useFeedbackForm(props: UseFeedbackOptions) {
  const {feedback, options} = useFeedback(props);

  const openForm = useCallback(async () => {
    if (!feedback) {
      return;
    }

    const form = await feedback.createForm(options);
    form.appendToDom();
    form.open();
  }, [feedback, options]);

  return {feedback, openForm};
}
