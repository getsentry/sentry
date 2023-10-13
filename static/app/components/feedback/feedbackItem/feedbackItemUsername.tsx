import styled from '@emotion/styled';

import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {HydratedFeedbackItem} from 'sentry/utils/feedback/item/types';

interface Props {
  detailDisplay: boolean;
  feedbackItem: HydratedFeedbackItem;
}

export default function FeedbackItemUsername({feedbackItem, detailDisplay}: Props) {
  const hasName = feedbackItem.user.name;
  const hasEmail = feedbackItem.contact_email;

  if (!hasEmail && !hasName) {
    return <strong>{t('Anonymous User')}</strong>;
  }

  if (detailDisplay) {
    return (
      <strong>
        {feedbackItem.user.name ?? 'No Name'}
        <Purple>•</Purple>
        {feedbackItem.contact_email ?? 'No Email'}
      </strong>
    );
  }

  return <strong>{feedbackItem.contact_email ?? feedbackItem.user.name}</strong>;
}

const Purple = styled('span')`
  color: ${p => p.theme.purple300};
  padding: ${space(0.5)};
`;
