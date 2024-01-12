import styled from '@emotion/styled';
import {Location} from 'history';

import {space} from 'sentry/styles/space';
import {
  Organization,
  PageFilters,
  Project,
  SessionFieldWithOperation,
} from 'sentry/types';
import {isPlatformANRCompatible} from 'sentry/views/projectDetail/utils';

import {ProjectAnrScoreCard} from './projectAnrScoreCard';
import ProjectApdexScoreCard from './projectApdexScoreCard';
import ProjectStabilityScoreCard from './projectStabilityScoreCard';
import ProjectVelocityScoreCard from './projectVelocityScoreCard';

type Props = {
  hasSessions: boolean | null;
  isProjectStabilized: boolean;
  location: Location;
  organization: Organization;
  selection: PageFilters;
  hasTransactions?: boolean;
  project?: Project;
  query?: string;
};

function ProjectScoreCards({
  organization,
  selection,
  isProjectStabilized,
  hasSessions,
  hasTransactions,
  query,
  location,
  project,
}: Props) {
  return (
    <CardWrapper>
      <ProjectStabilityScoreCard
        selection={selection}
        isProjectStabilized={isProjectStabilized}
        hasSessions={hasSessions}
        query={query}
        field={SessionFieldWithOperation.CRASH_FREE_RATE_SESSIONS}
      />

      <ProjectStabilityScoreCard
        selection={selection}
        isProjectStabilized={isProjectStabilized}
        hasSessions={hasSessions}
        query={query}
        field={SessionFieldWithOperation.CRASH_FREE_RATE_USERS}
      />

      <ProjectVelocityScoreCard
        organization={organization}
        selection={selection}
        isProjectStabilized={isProjectStabilized}
        query={query}
      />

      {isPlatformANRCompatible(project?.platform) ? (
        <ProjectAnrScoreCard
          organization={organization}
          selection={selection}
          isProjectStabilized={isProjectStabilized}
          query={query}
          location={location}
        />
      ) : (
        <ProjectApdexScoreCard
          organization={organization}
          selection={selection}
          isProjectStabilized={isProjectStabilized}
          hasTransactions={hasTransactions}
          query={query}
        />
      )}
    </CardWrapper>
  );
}

const CardWrapper = styled('div')`
  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    display: grid;
    grid-column-gap: ${space(2)};
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  @media (min-width: 1600px) {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
`;

export default ProjectScoreCards;
