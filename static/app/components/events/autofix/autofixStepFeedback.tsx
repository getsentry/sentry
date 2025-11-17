import {useCallback, useState} from 'react';

import {Button} from 'sentry/components/core/button';
import {Flex} from 'sentry/components/core/layout';
import {Text} from 'sentry/components/core/text';
import {IconThumb} from 'sentry/icons';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';

type StepType = 'root_cause' | 'solution' | 'changes';

interface AutofixStepFeedbackProps {
  groupId: string;
  runId: string;
  stepType: StepType;
}

export function AutofixStepFeedback({
  stepType,
  groupId,
  runId,
}: AutofixStepFeedbackProps) {
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const organization = useOrganization();
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
      <Flex align="center" gap="sm">
        <Text variant="muted">{t('Thanks!')}</Text>
      </Flex>
    );
  }

  return (
    <Flex align="center" gap="xs">
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
    </Flex>
  );
}
