import {Fragment} from 'react';
import styled from '@emotion/styled';

import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import {Flex} from 'sentry/components/profiling/flex';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {HydratedFeedbackItem} from 'sentry/utils/feedback/types';

interface Props {
  feedbackItem: HydratedFeedbackItem;
}

export default function FeedbackItemUsername({feedbackItem}: Props) {
  const displayValue = feedbackItem.user.display_name || feedbackItem.contact_email;
  const hasBoth = feedbackItem.user.display_name && feedbackItem.contact_email;
  if (!displayValue) {
    <strong>{t('Unknown User')}</strong>;
  }

  const Purple = styled('span')`
    color: ${p => p.theme.purple300};
  `;

  return (
    <Flex gap={space(1)} align="center">
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
      {feedbackItem.contact_email ? (
        <CopyToClipboardButton
          size="xs"
          iconSize="xs"
          text={feedbackItem.contact_email}
        />
      ) : null}
    </Flex>
  );
}
