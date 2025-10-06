import {Button} from 'sentry/components/core/button';
import {IconMegaphone} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useFeedbackForm} from 'sentry/utils/useFeedbackForm';

export function MonitorFeedbackButton() {
  const openForm = useFeedbackForm();

  if (!openForm) {
    return null;
  }

  return (
    <Button
      icon={<IconMegaphone />}
      size="sm"
      onClick={() =>
        openForm({
          messagePlaceholder: t('How can we improve the monitor experience?'),
          tags: {
            ['feedback.source']: 'monitors',
            ['feedback.owner']: 'aci',
          },
        })
      }
    >
      Feedback
    </Button>
  );
}
