import type {Location} from 'history';

import {Grid} from '@sentry/scraps/layout';

import type {PageFilters} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {SessionFieldWithOperation} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {isPlatformANRCompatible} from 'sentry/views/projectDetail/utils';

import {ProjectAnrScoreCard} from './projectAnrScoreCard';
import {ProjectApdexScoreCard} from './projectApdexScoreCard';
import {ProjectStabilityScoreCard} from './projectStabilityScoreCard';
import {ProjectVelocityScoreCard} from './projectVelocityScoreCard';

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

export function ProjectScoreCards({
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
    <Grid
      columns={{
        zero: '1fr',
        '3xl': 'repeat(2, minmax(0, 1fr))',
        '5xl': 'repeat(4, minmax(0, 1fr))',
      }}
      gap="xl"
      marginBottom="xl"
    >
      <ProjectStabilityScoreCard
        selection={selection}
        isProjectStabilized={isProjectStabilized}
        hasSessions={hasSessions}
        query={query}
        field={SessionFieldWithOperation.CRASH_FREE_RATE_SESSIONS}
        project={project}
      />

      <ProjectStabilityScoreCard
        selection={selection}
        isProjectStabilized={isProjectStabilized}
        hasSessions={hasSessions}
        query={query}
        field={SessionFieldWithOperation.CRASH_FREE_RATE_USERS}
        project={project}
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
          platform={project?.platform}
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
    </Grid>
  );
}
