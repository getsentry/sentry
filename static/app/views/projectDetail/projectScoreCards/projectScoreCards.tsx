import styled from '@emotion/styled';

import space from 'sentry/styles/space';
import {Organization, PageFilters, SessionField} from 'sentry/types';

import ProjectApdexScoreCard from './projectApdexScoreCard';
import ProjectStabilityScoreCard from './projectStabilityScoreCard';
import ProjectVelocityScoreCard from './projectVelocityScoreCard';

type Props = {
  hasSessions: boolean | null;
  isProjectStabilized: boolean;
  organization: Organization;
  selection: PageFilters;
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
        field={SessionField.SESSIONS}
        query={query}
      />

      <ProjectStabilityScoreCard
        organization={organization}
        selection={selection}
        isProjectStabilized={isProjectStabilized}
        hasSessions={hasSessions}
        field={SessionField.USERS}
        query={query}
        field={SessionField.SESSIONS}
      />

      <ProjectStabilityScoreCard
        organization={organization}
        selection={selection}
        isProjectStabilized={isProjectStabilized}
        hasSessions={hasSessions}
        query={query}
        field={SessionField.USERS}
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
  grid-template-columns: repeat(4, minmax(0, 1fr));
  grid-column-gap: ${space(2)};

  @media (max-width: 1600px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    grid-template-columns: 1fr;
    grid-template-rows: repeat(3, 1fr);
  }
`;

export default ProjectScoreCards;
