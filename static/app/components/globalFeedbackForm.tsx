import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
} from 'react';
import type {FeedbackDialog} from '@sentry/types';

import {
  useFeedback,
  type UseFeedbackOptions,
} from 'sentry/components/feedback/widget/useFeedback';

interface Props {
  children: ReactNode;
}

/**
 * A function that opens the feedback form. It accepts some option overrides
 * to change how the form is displayed.
 *
 * If `openForm` is `null`, then the feedback integration is not available
 * and feedback triggers should not be rendered.
 */
type ContextType = ((options?: UseFeedbackOptions) => Promise<void>) | null;

const GlobalFeedbackFormContext = createContext<ContextType>(null);

/**
 * Returns a function used to open the feedback form. If the return value is null,
 * then the feedback integration is not available and feedback triggers should not be rendered
 *
 *  Usage:
 *
 *  ```tsx
 * const openForm = useFeedbackForm();
 *
 * if (!openForm) {
 *   return null;
 * }
 *
 * return <Button onClick={() => openForm({formTitle: 'Custom Title'})}>{t('Give Feedback')}</button>;
 * ```
 */
export function useFeedbackForm() {
  return useContext(GlobalFeedbackFormContext);
}

function useOpenForm() {
  const formRef = useRef<FeedbackDialog | null>(null);
  const {feedback, options} = useFeedback({});

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

  return feedback ? openForm : null;
}

export function GlobalFeedbackForm({children}: Props) {
  const openForm = useOpenForm();

  return (
    <GlobalFeedbackFormContext.Provider value={openForm}>
      {children}
    </GlobalFeedbackFormContext.Provider>
  );
}
