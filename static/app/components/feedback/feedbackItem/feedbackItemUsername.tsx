import styled from '@emotion/styled';

import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {HydratedFeedbackItem} from 'sentry/utils/feedback/item/types';

interface Props {
  detailDisplay: boolean;
  feedbackItem: HydratedFeedbackItem;
}

export default function FeedbackItemUsername({feedbackItem, detailDisplay}: Props) {
  const name = ''; // feedbackItem.name;
  const email = feedbackItem.metadata.contact_email;

  if (!email && !name) {
    return <strong>{t('Anonymous User')}</strong>;
  }

  if (detailDisplay) {
    return (
      <strong>
        {name ?? t('No Name')}
        <Purple>•</Purple>
        {email ?? t('No Email')}
      </strong>
    );
  }

  return <strong>{email ?? name}</strong>;
}

const Purple = styled('span')`
  color: ${p => p.theme.purple300};
  padding: ${space(0.5)};
`;
