import {useEffect} from 'react';
import {useTheme} from '@emotion/react';
import {addIntegration, getClient} from '@sentry/react';

import useAsyncSDKIntegrationStore from 'sentry/views/app/asyncSDKIntegrationProvider';

/**
 * Add Feedback integration here as feedback is for Sentry employees, it
 * doesn't make sense to have it for self-hosted.
 */
export default function useFeedbackInit() {
  const {setState} = useAsyncSDKIntegrationStore();
  const theme = useTheme();

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

  useEffect(() => {
    const styleElement = document.createElement('style');
    styleElement.textContent = `
      #sentry-feedback {
        --foreground: ${theme.tokens.content.primary};
        --background: ${theme.tokens.background.primary};
        --accent-foreground: ${theme.colors.white};
        --accent-background: ${theme.colors.chonk.blue400};
        --success-color: ${theme.tokens.content.success};
        --error-color: ${theme.tokens.content.danger};
        --outline: 1px auto ${theme.tokens.border.accent};
        --interactive-filter: brightness(${theme.type === 'dark' ? '110%' : '95%'});
        --border: 1px solid ${theme.tokens.border.primary};
        --button-border-radius: ${theme.form.md.borderRadius};
        --button-primary-border-radius: ${theme.form.md.borderRadius};
        --input-border-radius: ${theme.form.md.borderRadius};
      }
    `;
    document.head.appendChild(styleElement);

    return () => {
      document.head.removeChild(styleElement);
    };
  }, [theme]);
}
