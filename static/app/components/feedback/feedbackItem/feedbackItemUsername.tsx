import {t} from 'sentry/locale';
import type {FeedbackItemResponse} from 'sentry/utils/feedback/types';

interface Props {
  detailDisplay: boolean;
  feedbackItem: FeedbackItemResponse;
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
