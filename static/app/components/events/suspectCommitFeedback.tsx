import {useCallback, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {IconThumb} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Commit} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useUser} from 'sentry/utils/useUser';

interface CommitWithGroupOwner extends Commit {
  group_owner_id: number;
}

interface SuspectCommitFeedbackProps {
  commit: CommitWithGroupOwner;
  organization: Organization;
}

export function SuspectCommitFeedback({
  commit,
  organization,
}: SuspectCommitFeedbackProps) {
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const user = useUser();

  const handleFeedback = useCallback(
    (isCorrect: boolean) => {
      const analyticsData = {
        choice_selected: isCorrect,
        group_owner_id: commit.group_owner_id,
        user_id: user.id,
        organization,
      };

      trackAnalytics('suspect_commit.feedback_submitted', analyticsData);

      setFeedbackSubmitted(true);
    },
    [commit, organization, user]
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
      <ButtonGroup>
        <Button
          size="xs"
          icon={<IconThumb direction="up" size="sm" />}
          onClick={() => handleFeedback(true)}
          aria-label={t('Yes, this suspect commit is correct')}
        />
        <Button
          size="xs"
          icon={<IconThumb direction="down" size="sm" />}
          onClick={() => handleFeedback(false)}
          aria-label={t('No, this suspect commit is incorrect')}
        />
      </ButtonGroup>
    </FeedbackContainer>
  );
}

const FeedbackContainer = styled('div')`
  position: absolute;
  top: ${space(1)};
  right: ${space(1)};
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: ${space(0.5)};

  @media (max-width: ${p => p.theme.breakpoints.xs}) {
    display: none;
  }
`;

const FeedbackText = styled('span')`
  font-size: ${p => p.theme.fontSize.md};
  line-height: 1.5;
  color: ${p => p.theme.tokens.content.secondary};
  white-space: nowrap;
`;

const ThankYouText = styled('span')`
  font-size: ${p => p.theme.fontSize.md};
  line-height: 1.5;
  color: ${p => p.theme.tokens.content.secondary};
  white-space: nowrap;
`;

const ButtonGroup = styled('div')`
  display: flex;
  gap: ${space(0.25)};
`;
