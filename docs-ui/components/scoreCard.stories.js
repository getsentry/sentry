import React from 'react';
import styled from '@emotion/styled';

import ScoreCard from 'app/components/scoreCard';
import {t} from 'app/locale';
import space from 'app/styles/space';

export default {
  title: 'UI/ScoreCard',
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
Default.storyName = 'default';

const Wrapper = styled('div')`
  display: grid;
  grid-gap: ${space(1)};
  grid-template-columns: repeat(4, minmax(0, 1fr));
`;
