import {useCallback, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {IconThumb} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useUser} from 'sentry/utils/useUser';

type StepType = 'root_cause' | 'solution' | 'changes';

interface AutofixStepFeedbackProps {
  groupId: string;
  organization: Organization;
  runId: string;
  stepType: StepType;
}

export function AutofixStepFeedback({
  stepType,
  groupId,
  runId,
  organization,
}: AutofixStepFeedbackProps) {
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const user = useUser();

  const handleFeedback = useCallback(
    (positive: boolean) => {
      const analyticsData = {
        step_type: stepType,
        positive,
        group_id: groupId,
        autofix_run_id: runId,
        user_id: user.id,
        organization,
      };

      trackAnalytics('seer.autofix.feedback_submitted', analyticsData);

      setFeedbackSubmitted(true);
    },
    [stepType, groupId, runId, organization, user]
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
      <ButtonGroup>
        <Button
          size="xs"
          icon={<IconThumb direction="up" size="sm" />}
          onClick={() => handleFeedback(true)}
          aria-label={t('This step was helpful')}
        />
        <Button
          size="xs"
          icon={<IconThumb direction="down" size="sm" />}
          onClick={() => handleFeedback(false)}
          aria-label={t('This step was not helpful')}
        />
      </ButtonGroup>
    </FeedbackContainer>
  );
}

const FeedbackContainer = styled('div')`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: ${space(0.5)};
`;

const ThankYouText = styled('span')`
  font-size: ${p => p.theme.fontSize.md};
  line-height: 1.5;
  color: ${p => p.theme.subText};
  white-space: nowrap;
`;

const ButtonGroup = styled('div')`
  display: flex;
  gap: ${space(0.25)};
`;
