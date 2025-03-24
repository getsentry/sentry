import styled from '@emotion/styled';

import {FeatureFeedback} from 'sentry/components/featureFeedback';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {MIN_HEIGHT, MIN_WIDTH} from 'sentry/views/dashboards/widgets/common/settings';

export default function GiveFeedbackSection() {
  return (
    <ChartContainer>
      <FeedbackHeading>{t(`Are we missing a chart you'd like to see?`)}</FeedbackHeading>
      <FeatureFeedback
        featureName="session-health"
        feedbackTypes={[t('Useful chart'), t('Useless chart'), t('Other')]}
        buttonProps={{size: 'md'}}
      />
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
`;

const FeedbackHeading = styled('div')`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  font-weight: bold;
`;
