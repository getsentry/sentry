import React from 'react';
import styled from '@emotion/styled';

import ScoreCard from 'app/components/scoreCard';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {GlobalSelection, Organization} from 'app/types';
import withGlobalSelection from 'app/utils/withGlobalSelection';

import ProjectApdexScoreCard from './projectApdexScoreCard';
import ProjectVelocityScoreCard from './projectVelocityScoreCard';

type Props = {
  organization: Organization;
  selection: GlobalSelection;
};

function ProjectScoreCards({organization, selection}: Props) {
  return (
    <CardWrapper>
      <ScoreCard
        title={t('Stability Score')}
        help={t('Stability score is used to // TODO(project-detail)')}
        score="94.1%"
        trend="+13.5%"
        trendStyle="good"
      />

      <ProjectVelocityScoreCard organization={organization} selection={selection} />

      <ProjectApdexScoreCard organization={organization} selection={selection} />
    </CardWrapper>
  );
}

const CardWrapper = styled('div')`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  grid-gap: ${space(2)};
  margin-bottom: ${space(3)};

  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    grid-template-columns: 1fr;
    grid-template-rows: repeat(3, 1fr);
  }
`;

export default withGlobalSelection(ProjectScoreCards);
