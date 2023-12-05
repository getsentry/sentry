import {useEffect, useRef} from 'react';
import {Feedback, getCurrentHub} from '@sentry/react';

import {Button} from 'sentry/components/button';
import {IconMegaphone} from 'sentry/icons/iconMegaphone';
import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';

function CronsFeedbackButton() {
  const config = useLegacyStore(ConfigStore);
  const ref = useRef(null);
  const title = 'Give Feedback';
  const widgetTheme = config.theme === 'dark' ? 'dark' : 'light';
  const hub = getCurrentHub();
  const feedback = hub.getIntegration(Feedback);

  useEffect(() => {
    const widget =
      ref.current &&
      feedback?.attachTo(ref.current, {
        colorScheme: widgetTheme,
        formTitle: title,
        submitButtonLabel: 'Send Feedback',
        messagePlaceholder: 'What did you expect?',
      });

    return () => {
      if (widget && feedback) {
        feedback.removeWidget(widget);
      }
    };
  }, [widgetTheme, feedback]);

  // Do not show button if Feedback integration is not enabled
  if (!feedback) {
    return null;
  }

  return (
    <Button ref={ref} data-feedback="crons" size="sm" icon={<IconMegaphone />}>
      {title}
    </Button>
  );
}

export default CronsFeedbackButton;
