import {useRef} from 'react';

import {Button} from 'sentry/components/button';
import useFeedbackWidget from 'sentry/components/feedback/widget/useFeedbackWidget';
import {IconMegaphone} from 'sentry/icons/iconMegaphone';
import {t} from 'sentry/locale';

interface Props {
  parentElement?: Element;
}

export default function FeedbackWidgetButton({parentElement}: Props) {
  console.log('widgetbutton render', parentElement);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const feedback = useFeedbackWidget({buttonRef, parentElement});

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
