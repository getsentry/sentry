import styled from '@emotion/styled';

import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {FeedbackEvent, FeedbackIssue} from 'sentry/utils/feedback/types';

interface Props {
  detailDisplay: boolean;
  feedbackIssue: FeedbackIssue;
  feedbackEvent?: FeedbackEvent | undefined;
}

export default function FeedbackItemUsername({
  feedbackIssue,
  feedbackEvent,
  detailDisplay,
}: Props) {
  const name = feedbackEvent?.contexts?.feedback?.name;
  const email = feedbackIssue.metadata.contact_email;

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

  return <strong>{email}</strong>;
}

const Purple = styled('span')`
  color: ${p => p.theme.purple300};
  padding: ${space(0.5)};
`;
