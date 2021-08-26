import styled from '@emotion/styled';

import space from 'app/styles/space';
import {GlobalSelection, Organization} from 'app/types';

import ProjectApdexScoreCard from './projectApdexScoreCard';
import ProjectStabilityScoreCard from './projectStabilityScoreCard';
import ProjectVelocityScoreCard from './projectVelocityScoreCard';

type Props = {
  organization: Organization;
  selection: GlobalSelection;
  isProjectStabilized: boolean;
  hasSessions: boolean | null;
  hasTransactions?: boolean;
  query?: string;
};

function ProjectScoreCards({
  organization,
  selection,
  isProjectStabilized,
  hasSessions,
  hasTransactions,
  query,
}: Props) {
  return (
    <CardWrapper>
      <ProjectStabilityScoreCard
        organization={organization}
        selection={selection}
        isProjectStabilized={isProjectStabilized}
        hasSessions={hasSessions}
        query={query}
      />

      <ProjectVelocityScoreCard
        organization={organization}
        selection={selection}
        isProjectStabilized={isProjectStabilized}
        query={query}
      />

      <ProjectApdexScoreCard
        organization={organization}
        selection={selection}
        isProjectStabilized={isProjectStabilized}
        hasTransactions={hasTransactions}
        query={query}
      />
    </CardWrapper>
  );
}

const CardWrapper = styled('div')`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  grid-column-gap: ${space(2)};

  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    grid-template-columns: 1fr;
    grid-template-rows: repeat(3, 1fr);
  }
`;

export default ProjectScoreCards;
