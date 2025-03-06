import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {IconMegaphone} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useFeedbackForm} from 'sentry/utils/useFeedbackForm';

export default function DynamicAlertsFeedbackButton() {
  const openForm = useFeedbackForm();

  if (!openForm) {
    return null;
  }

  return (
    <ButtonContainer>
      <Button
        onClick={() => {
          openForm({
            formTitle: 'Anomaly Detection Feedback',
            messagePlaceholder: t(
              'How can we make alerts using anomaly detection more useful?'
            ),
            tags: {
              ['feedback.source']: 'dynamic_thresholding',
              ['feedback.owner']: 'ml-ai',
            },
          });
        }}
        size="xs"
        icon={<IconMegaphone />}
      >
        Give Feedback
      </Button>
    </ButtonContainer>
  );
}

const ButtonContainer = styled('div')`
  padding: 8px 0px;
`;
