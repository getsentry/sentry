import {t} from 'sentry/locale';
import type {HydratedFeedbackItem} from 'sentry/utils/feedback/item/types';

interface Props {
  detailDisplay: boolean;
  feedbackItem: HydratedFeedbackItem;
}

export default function FeedbackItemUsername({feedbackItem, detailDisplay}: Props) {
  const email = feedbackItem.metadata.contact_email;

  if (!email) {
    return <strong>{t('Anonymous User')}</strong>;
  }

  if (detailDisplay) {
    return <strong>{email ?? t('No Email')}</strong>;
  }

  return <strong>{email}</strong>;
}
