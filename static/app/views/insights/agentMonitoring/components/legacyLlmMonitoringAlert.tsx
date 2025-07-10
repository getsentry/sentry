import {useRef} from 'react';
import styled from '@emotion/styled';

import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
import useFeedbackWidget from 'sentry/components/feedback/widget/useFeedbackWidget';
import {IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useDismissAlert from 'sentry/utils/useDismissAlert';

const LOCAL_STORAGE_KEY = 'llm-monitoring-info-alert-dismissed';

export function LegacyLLMMonitoringInfoAlert() {
  const {dismiss, isDismissed} = useDismissAlert({key: LOCAL_STORAGE_KEY});
  const buttonRef = useRef<HTMLButtonElement>(null);
  const feedback = useFeedbackWidget({
    buttonRef,
    optionOverrides: {
      tags: {
        ['feedback.source']: 'agent-monitoring',
        ['feedback.owner']: 'telemetry-experience',
      },
    },
  });

  if (isDismissed) {
    return null;
  }

  return (
    <StyledAlert
      type="info"
      showIcon
      trailingItems={
        <Button
          priority="link"
          size="sm"
          icon={<IconClose />}
          onClick={dismiss}
          aria-label={t('Close Alert')}
          borderless
        />
      }
    >
      <Message>
        {t(
          'Expecting to see data for your AI Agent here? Let us know if something is missing!'
        )}
        {feedback && (
          <Button ref={buttonRef} size="xs" priority="primary">
            {t('Give Feedback')}
          </Button>
        )}
      </Message>
    </StyledAlert>
  );
}

const StyledAlert = styled(Alert)`
  margin-bottom: ${space(2)};
`;

const Message = styled('span')`
  display: flex;
  flex-grow: 1;
  gap: ${space(1)};
  align-items: center;
`;
