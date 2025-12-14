import {useCallback, useState} from 'react';

import {Button} from 'sentry/components/core/button';
import type {ButtonProps} from 'sentry/components/core/button';
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
  buttonSize?: ButtonProps['size'];
  compact?: boolean;
  onFeedbackClick?: (e: React.MouseEvent) => void;
}

export function AutofixStepFeedback({
  stepType,
  groupId,
  runId,
  buttonSize = 'xs',
  compact = false,
  onFeedbackClick,
}: AutofixStepFeedbackProps) {
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const organization = useOrganization();
  const user = useUser();

  const handleFeedback = useCallback(
    (positive: boolean, e?: React.MouseEvent) => {
      if (onFeedbackClick && e) {
        onFeedbackClick(e);
      }

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
    [stepType, groupId, runId, organization, user, onFeedbackClick]
  );

  if (feedbackSubmitted) {
    return (
      <Flex
        align="center"
        gap={compact ? '0' : 'sm'}
        onClick={onFeedbackClick}
        style={{cursor: onFeedbackClick ? 'default' : undefined}}
      >
        <Text variant="muted" size={compact ? 'xs' : 'sm'}>
          {t('Thanks!')}
        </Text>
      </Flex>
    );
  }

  const iconSize = buttonSize === 'zero' ? 'xs' : 'sm';
  const gap = compact ? '2xs' : 'xs';

  return (
    <Flex align="center" gap={gap}>
      <Button
        size={buttonSize}
        borderless={compact}
        icon={<IconThumb direction="up" size={iconSize} />}
        onClick={e => handleFeedback(true, e)}
        aria-label={t('This was helpful')}
      />
      <Button
        size={buttonSize}
        borderless={compact}
        icon={<IconThumb direction="down" size={iconSize} />}
        onClick={e => handleFeedback(false, e)}
        aria-label={t('This was not helpful')}
      />
    </Flex>
  );
}
