import {useRef} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {IconMegaphone} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useFeedbackForm} from 'sentry/utils/useFeedbackForm';
import {MIN_HEIGHT, MIN_WIDTH} from 'sentry/views/dashboards/widgets/common/settings';

function FeedbackButton() {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const openForm = useFeedbackForm();

  if (!openForm) {
    return null;
  }

  return (
    <Button
      ref={buttonRef}
      icon={<IconMegaphone />}
      size="md"
      onClick={() =>
        openForm({
          messagePlaceholder: t('How can we make Session Health more useful for you?'),
          tags: {
            ['feedback.source']: 'insights.session_health',
            ['feedback.owner']: 'replay',
          },
        })
      }
    >
      {t('Give Feedback')}
    </Button>
  );
}

export default function GiveFeedbackSection() {
  return (
    <ChartContainer>
      <FeedbackHeading>{t(`Are we missing a chart you'd like to see?`)}</FeedbackHeading>
      <FeedbackButton />
    </ChartContainer>
  );
}

const ChartContainer = styled('div')`
  height: 220px;
  min-height: ${MIN_HEIGHT}px;
  min-width: ${MIN_WIDTH}px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  border-radius: ${p => p.theme.borderRadius};
  border: 1px solid ${p => p.theme.border};
  background: ${p => p.theme.background};
  gap: ${space(2)};
  padding: ${space(4)};
`;

const FeedbackHeading = styled('div')`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  font-weight: bold;
  text-align: center;
`;
