import {Fragment} from 'react';
import styled from '@emotion/styled';

import {t} from 'sentry/locale';
import type {HydratedFeedbackItem} from 'sentry/utils/feedback/item/types';

interface Props {
  feedbackItem: HydratedFeedbackItem;
}

export default function FeedbackItemUsername({feedbackItem}: Props) {
  const displayValue = feedbackItem.user.display_name || feedbackItem.contact_email;
  const hasBoth = feedbackItem.user.display_name && feedbackItem.contact_email;
  if (!displayValue) {
    return <strong>{t('Unknown User')}</strong>;
  }

  return (
    <strong>
      {hasBoth ? (
        <Fragment>
          {feedbackItem.user.display_name}
          <Purple>•</Purple>
          {feedbackItem.contact_email}
        </Fragment>
      ) : (
        displayValue
      )}
    </strong>
  );
}

const Purple = styled('span')`
  color: ${p => p.theme.purple300};
`;
