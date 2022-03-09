import styled from '@emotion/styled';

import ScoreCard from 'sentry/components/scoreCard';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';

export default {
  title: 'Components/Data Visualization/Score Card',
  component: ScoreCard,
};

export const Default = () => (
  <Wrapper>
    <ScoreCard
      title={t('First Score')}
      help={t('First score is used to ...')}
      score="94.1%"
      trend="+13.5%"
      trendStatus="good"
    />
    <ScoreCard
      title={t('Velocity Score')}
      help={t('Velocity score is used to ...')}
      score="16"
      trend="-2 releases / 2 wks"
      trendStatus="bad"
    />
    <ScoreCard
      title={t('Other Score')}
      help={t('Other score is used to ...')}
      score="0.95"
      trend="+0.2"
    />
    <ScoreCard title={t('Minimal')} />
  </Wrapper>
);
Default.storyName = 'Default';

const Wrapper = styled('div')`
  display: grid;
  gap: ${space(1)};
  grid-template-columns: repeat(4, minmax(0, 1fr));
`;
