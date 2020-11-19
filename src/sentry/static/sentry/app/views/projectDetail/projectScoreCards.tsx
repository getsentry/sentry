import React from 'react';
import styled from '@emotion/styled';

import AsyncComponent from 'app/components/asyncComponent';
import ScoreCard from 'app/components/scoreCard';
import {t} from 'app/locale';
import space from 'app/styles/space';

type Props = AsyncComponent['props'] & {};
type State = AsyncComponent['state'] & {};

class ProjectScoreCards extends AsyncComponent<Props, State> {
  renderBody() {
    return (
      <CardWrapper>
        <ScoreCard
          title={t('Stability Score')}
          help={t('Stability score is used to ...')}
          score="94.1%"
          trend="+13.5%"
          trendStyle="good"
        />
        <ScoreCard
          title={t('Velocity Score')}
          help={t('Velocity score is used to ...')}
          score="16"
          trend="-2 releases / 2 wks"
          trendStyle="bad"
        />
        <ScoreCard
          title={t('Apdex Score')}
          help={t('Apdex score is used to ...')}
          score="0.95"
          trend="+0.2"
          trendStyle="good"
        />
      </CardWrapper>
    );
  }
}

const CardWrapper = styled('div')`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  grid-gap: ${space(2)};
  margin-bottom: ${space(3)};

  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    grid-template-columns: 1fr;
    grid-template-rows: 1fr 1fr 1fr;
  }
`;

export default ProjectScoreCards;
