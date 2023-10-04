import {Button} from 'sentry/components/button';
import {IconArchive} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {HydratedFeedbackItem} from 'sentry/utils/feedback/item/types';

interface Props {
  feedbackItem: HydratedFeedbackItem;
}

export default function ResolveButton({feedbackItem}: Props) {
  if (feedbackItem.status === 'unresolved') {
    return (
      <Button priority="primary" size="xs" icon={<IconArchive />}>
        {t('Resolve')}
      </Button>
    );
  }

  return (
    <Button size="xs" icon={<IconArchive />}>
      {t('Unresolve')}
    </Button>
  );
}
