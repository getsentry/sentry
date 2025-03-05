import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
} from 'react';
import type {FeedbackModalIntegration} from '@sentry/core';
import isEqual from 'lodash/isEqual';

import {
  useFeedback,
  type UseFeedbackOptions,
} from 'sentry/components/feedback/widget/useFeedback';

/**
 * A function that opens the feedback form. It accepts some option overrides
 * to change how the form is displayed.
 *
 * If `openForm` is `null`, then the feedback integration is not available
 * and feedback triggers should not be rendered.
 */
type OpenForm = ((options?: UseFeedbackOptions) => Promise<void>) | null;

type FeedbackDialog = ReturnType<FeedbackModalIntegration['createDialog']>;

const GlobalFeedbackFormContext = createContext<OpenForm>(null);

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
  // The options that were used to create the currently created form instance
  // This is used to determine if we should reuse the existing form instance
  const formOptionsOverrideRef = useRef<UseFeedbackOptions | null>(null);

  const {feedback, options} = useFeedback({});

  const close = useCallback(() => {
    if (formRef.current) {
      formRef.current.close();
    }
  }, []);

  const cleanup = useCallback(() => {
    try {
      if (formRef.current) {
        formOptionsOverrideRef.current = null;
        formRef.current.close();
        formRef.current.removeFromDom();
        formRef.current = null;
      }
    } catch {
      // If the form is already removed from the DOM, then we can ignore this error
    }
  }, []);

  const openForm = useCallback(
    async (optionOverrides?: UseFeedbackOptions) => {
      if (!feedback) {
        return;
      }

      if (
        formRef.current &&
        isEqual(formOptionsOverrideRef.current, optionOverrides ?? null)
      ) {
        formRef.current.open();
      } else {
        cleanup();

        formRef.current = await feedback.createForm({
          ...options,
          ...optionOverrides,
          onFormClose: close,
          onFormSubmitted: cleanup,
        });

        formOptionsOverrideRef.current = optionOverrides ?? null;
        formRef.current.appendToDom();
        formRef.current.open();
      }
    },
    [cleanup, feedback, options, close]
  );

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return feedback ? openForm : null;
}

/**
 * Provider for the global feedback form context. Should only be rendered in the app root.
 */
export function GlobalFeedbackForm({children}: {children: ReactNode}) {
  const openForm = useOpenForm();

  return (
    <GlobalFeedbackFormContext.Provider value={openForm}>
      {children}
    </GlobalFeedbackFormContext.Provider>
  );
}
