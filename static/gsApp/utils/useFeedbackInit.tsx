import {useEffect} from 'react';
import {addIntegration, getClient} from '@sentry/react';

import useAsyncSDKIntegrationStore from 'sentry/views/app/asyncSDKIntegrationProvider';

/**
 * Add Feedback integration here as feedback is for Sentry employees, it
 * doesn't make sense to have it for self-hosted.
 */
export default function useFeedbackInit() {
  const {setState} = useAsyncSDKIntegrationStore();

  useEffect(() => {
    async function init() {
      const {feedbackIntegration} = await import('@sentry/react');
      const client = getClient();

      if (!client?.getIntegrationByName?.('Feedback')) {
        const feedback = feedbackIntegration({
          useSentryUser: {
            email: 'email',
            name: 'name',
          },
          autoInject: false,
          showEmail: false,
          showName: false,
        });

        addIntegration(feedback);
        setState(prev => ({...prev, Feedback: feedback}));
      }
    }

    init();
  }, [setState]);
}
