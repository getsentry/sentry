import type {RefObject} from 'react';
import {useEffect} from 'react';

import {useFeedback} from 'sentry/components/feedback/widget/useFeedback';

interface Props {
  buttonRef?: RefObject<HTMLButtonElement> | RefObject<HTMLAnchorElement>;
  formTitle?: string;
  messagePlaceholder?: string;
  parentElement?: Element;
}

export default function useFeedbackWidget({
  buttonRef,
  formTitle,
  messagePlaceholder,
  parentElement,
}: Props) {
  const {feedback, options} = useFeedback({formTitle, messagePlaceholder});

  useEffect(() => {
    if (!feedback) {
      return undefined;
    }

    if (buttonRef) {
      if (buttonRef.current) {
        return feedback.attachTo(buttonRef.current, {...options, parentElement});
      }
    } else {
      const widget = feedback.createWidget({...options, parentElement});
      return () => {
        widget.removeFromDom();
      };
    }

    return undefined;
  }, [buttonRef, feedback, options, parentElement]);

  return feedback;
}
