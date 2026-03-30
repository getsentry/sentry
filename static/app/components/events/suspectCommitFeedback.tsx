import {useCallback, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';

import {IconThumb} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useUser} from 'sentry/utils/useUser';

interface SuspectCommitFeedbackProps {
  groupOwnerId: number;
  organization: Organization;
}

export function SuspectCommitFeedback({
  groupOwnerId,
  organization,
}: SuspectCommitFeedbackProps) {
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const user = useUser();

  const handleFeedback = useCallback(
    (isCorrect: boolean) => {
      const analyticsData = {
        choice_selected: isCorrect,
        group_owner_id: groupOwnerId,
        user_id: user.id,
        organization,
      };

      trackAnalytics('suspect_commit.feedback_submitted', analyticsData);

      setFeedbackSubmitted(true);
    },
    [groupOwnerId, organization, user]
  );

  if (feedbackSubmitted) {
    return (
      <FeedbackContainer>
        <ThankYouText>{t('Thanks!')}</ThankYouText>
      </FeedbackContainer>
    );
  }

  return (
    <FeedbackContainer>
      <FeedbackText>{t('Is this correct?')}</FeedbackText>
      <Flex gap="2xs">
        <Button
          size="zero"
          icon={<IconThumb direction="up" size="xs" />}
          onClick={() => handleFeedback(true)}
          aria-label={t('Yes, this suspect commit is correct')}
        />
        <Button
          size="zero"
          icon={<IconThumb direction="down" size="xs" />}
          onClick={() => handleFeedback(false)}
          aria-label={t('No, this suspect commit is incorrect')}
        />
      </Flex>
    </FeedbackContainer>
  );
}

const FeedbackContainer = styled('div')`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: ${p => p.theme.space.xs};

  @media (max-width: ${p => p.theme.breakpoints.xs}) {
    display: none;
  }
`;

const FeedbackText = styled('span')`
  font-size: ${p => p.theme.font.size.md};
  line-height: 1.5;
  color: ${p => p.theme.tokens.content.secondary};
  white-space: nowrap;
`;

const ThankYouText = styled('span')`
  font-size: ${p => p.theme.font.size.md};
  line-height: 1.5;
  color: ${p => p.theme.tokens.content.secondary};
  white-space: nowrap;
`;
