import {Button} from 'sentry/components/core/button';
import {IconMegaphone} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useFeedbackForm} from 'sentry/utils/useFeedbackForm';

export function AutomationFeedbackButton() {
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
          messagePlaceholder: t('How can we improve the automation experience?'),
          tags: {
            ['feedback.source']: 'automations',
            ['feedback.owner']: 'aci',
          },
        })
      }
    >
      Feedback
    </Button>
  );
}
