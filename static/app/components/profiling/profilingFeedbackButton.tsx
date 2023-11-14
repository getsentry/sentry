import {useEffect, useRef} from 'react';
import {BrowserClient, getCurrentHub} from '@sentry/react';
import {Feedback} from '@sentry-internal/feedback';

import {Button} from 'sentry/components/button';
import {IconMegaphone} from 'sentry/icons/iconMegaphone';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';

function ProfilingFeedbackButton() {
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const config = useLegacyStore(ConfigStore);
  const hub = getCurrentHub();
  const client = hub.getClient<BrowserClient>();
  const feedback = client?.getIntegration(Feedback);

  useEffect(() => {
    if (!buttonRef.current || !feedback) {
      return undefined;
    }

    const widget = feedback.attachTo(buttonRef.current, {
      colorScheme: config.theme === 'dark' ? 'dark' : 'light',
      formTitle: t('Give Feedback'),
      submitButtonLabel: t('Send Feedback'),
      messagePlaceholder: t('What did you expect?'),
    });

    return () => {
      if (widget && feedback) {
        feedback.removeWidget(widget);
      }
    };
  }, [feedback, config.theme]);

  if (!feedback) {
    return null;
  }

  return (
    <Button ref={buttonRef} data-feedback="profiling" size="sm" icon={<IconMegaphone />}>
      {t('Give Feedback')}
    </Button>
  );
}

export default ProfilingFeedbackButton;
