import {useEffect, useRef} from 'react';
import {Feedback, getCurrentHub} from '@sentry/react';

import {Button} from 'sentry/components/button';
import {IconMegaphone} from 'sentry/icons/iconMegaphone';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';

export default function FeedbackWidgetButton() {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const config = useLegacyStore(ConfigStore);
  const hub = getCurrentHub();
  const feedback = hub.getIntegration(Feedback);

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
  }, [config.theme, feedback]);

  // Do not show button if Feedback integration is not enabled
  if (!feedback) {
    return null;
  }

  return (
    <Button ref={buttonRef} size="sm" icon={<IconMegaphone />}>
      {t('Give Feedback')}
    </Button>
  );
}
