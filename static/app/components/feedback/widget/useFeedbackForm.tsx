import {useCallback, useEffect, useRef} from 'react';
import type {FeedbackDialog} from '@sentry/types';

import {
  useFeedback,
  type UseFeedbackOptions,
} from 'sentry/components/feedback/widget/useFeedback';

export function useFeedbackForm(props: UseFeedbackOptions) {
  const formRef = useRef<FeedbackDialog | null>(null);
  const {feedback, options} = useFeedback(props);

  const openForm = useCallback(
    async (optionOverrides?: UseFeedbackOptions) => {
      if (!feedback) {
        return;
      }

      if (formRef.current) {
        formRef.current.removeFromDom();
      }

      formRef.current = await feedback.createForm({...options, ...optionOverrides});
      formRef.current.appendToDom();
      formRef.current.open();
    },
    [feedback, options]
  );

  // Cleanup the leftover form element when the component unmounts
  useEffect(() => {
    return () => {
      if (!formRef.current) {
        return;
      }

      formRef.current.removeFromDom();
    };
  }, []);

  return {feedback, openForm};
}
