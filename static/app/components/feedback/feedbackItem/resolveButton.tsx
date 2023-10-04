import {Button} from 'sentry/components/button';
import {IconArchive} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {HydratedFeedbackItem} from 'sentry/utils/feedback/item/types';

interface Props {
  feedbackItem: HydratedFeedbackItem;
}

export default function ResolveButton({feedbackItem}: Props) {
  if (feedbackItem.status !== 'resolved') {
    return (
      <Button disabled priority="primary" size="xs" icon={<IconArchive size="xs" />}>
        {t('Resolve')}
      </Button>
    );
  }

  return (
    <Button disabled priority="primary" size="xs" icon={<IconArchive size="xs" />}>
      {t('Unresolve')}
    </Button>
  );
}
