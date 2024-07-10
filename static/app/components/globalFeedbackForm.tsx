import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import type {FeedbackDialog} from '@sentry/types';

import {
  type FeedbackIntegration,
  useFeedback,
  type UseFeedbackOptions,
} from 'sentry/components/feedback/widget/useFeedback';

interface GlobalFeedbackFormProps {
  children: ReactNode;
}

interface GlobalFeedbackFormContextType {
  feedback: FeedbackIntegration | undefined;
  openForm: (options?: UseFeedbackOptions) => Promise<void>;
}

const GlobalFeedbackFormContext = createContext<GlobalFeedbackFormContextType>({
  feedback: undefined,
  openForm: Promise.resolve,
});

/**
 * Returns two properties:
 *
 * - `feedback`: The feedback integration object. If undefined, the feedback
 *               integration is not available and feedback buttons should not
 *               be rendered.
 * - `openForm`: A function that opens the feedback form. It accepts some
 *               option overrides to change how the form is displayed.
 *
 *  Usage:
 *
 *  ```tsx
 * const {feedback, openForm} = useFeedbackForm();
 *
 * if (!feedback) {
 *   return null;
 * }
 *
 * return <Button onClick={() => openForm()}>{t('Give Feedback')}</button>;
 * ```
 */
export function useFeedbackForm() {
  return useContext(GlobalFeedbackFormContext);
}

function useInternalFeedbackForm(props: UseFeedbackOptions) {
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

export function GlobalFeedbackForm({children}: GlobalFeedbackFormProps) {
  const {feedback, openForm} = useInternalFeedbackForm({});

  const value = useMemo(
    () => ({
      feedback,
      openForm,
    }),
    [feedback, openForm]
  );

  return (
    <GlobalFeedbackFormContext.Provider value={value}>
      {children}
    </GlobalFeedbackFormContext.Provider>
  );
}
