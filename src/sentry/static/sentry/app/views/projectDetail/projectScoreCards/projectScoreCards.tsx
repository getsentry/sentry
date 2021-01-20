import React from 'react';
import styled from '@emotion/styled';

import space from 'app/styles/space';
import {GlobalSelection, Organization} from 'app/types';
import withGlobalSelection from 'app/utils/withGlobalSelection';

import ProjectApdexScoreCard from './projectApdexScoreCard';
import ProjectStabilityScoreCard from './projectStabilityScoreCard';
import ProjectVelocityScoreCard from './projectVelocityScoreCard';

type Props = {
  organization: Organization;
  selection: GlobalSelection;
};

function ProjectScoreCards({organization, selection}: Props) {
  return (
    <CardWrapper>
      <ProjectStabilityScoreCard organization={organization} selection={selection} />

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
