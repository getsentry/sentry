import type {RefObject} from 'react';
import {useEffect} from 'react';

import {useFeedback} from 'sentry/components/feedback/widget/useFeedback';

interface Props {
  buttonRef?: RefObject<HTMLButtonElement> | RefObject<HTMLAnchorElement>;
  formTitle?: string;
  messagePlaceholder?: string;
}

export default function useFeedbackWidget({
  buttonRef,
  formTitle,
  messagePlaceholder,
}: Props) {
  const {feedback, options} = useFeedback({formTitle, messagePlaceholder});

  useEffect(() => {
    if (!feedback) {
      return undefined;
    }

    if (buttonRef) {
      if (buttonRef.current) {
        return feedback.attachTo(buttonRef.current, options);
      }
    } else {
      const widget = feedback.createWidget(options);
      return () => {
        widget.removeFromDom();
      };
    }

    return undefined;
  }, [buttonRef, feedback, options]);

  return feedback;
}
