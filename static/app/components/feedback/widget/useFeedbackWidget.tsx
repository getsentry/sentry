import type {RefObject} from 'react';
import {useEffect} from 'react';

import type {UseFeedbackOptions} from 'sentry/components/feedback/widget/useFeedback';
import {useFeedback} from 'sentry/components/feedback/widget/useFeedback';

interface Props {
  buttonRef?: RefObject<HTMLButtonElement> | RefObject<HTMLAnchorElement>;
  formTitle?: string;
  messagePlaceholder?: string;
  optionOverrides?: UseFeedbackOptions;
}

export default function useFeedbackWidget({
  buttonRef,
  formTitle,
  messagePlaceholder,
  optionOverrides,
}: Props) {
  const {feedback, options: defaultOptions} = useFeedback({
    formTitle,
    messagePlaceholder,
  });

  useEffect(() => {
    if (!feedback) {
      return undefined;
    }

    const options = {
      ...defaultOptions,
      ...optionOverrides,
      tags: {
        ...defaultOptions.tags,
        ...optionOverrides?.tags,
      },
    };

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
  }, [buttonRef, feedback, defaultOptions, optionOverrides]);

  return feedback;
}
