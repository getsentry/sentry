import {useMemo} from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import Breadcrumbs, {Crumb} from 'sentry/components/breadcrumbs';
import {t} from 'sentry/locale';
import {Organization, Project} from 'sentry/types';
import {
  generateProfileFlamechartRouteWithQuery,
  generateProfileSummaryRouteWithQuery,
  generateProfilingRouteWithQuery,
} from 'sentry/utils/profiling/routes';

interface BreadcrumbProps {
  location: Location;
  organization: Organization;
  trails: Trail[];
}

function Breadcrumb({location, organization, trails}: BreadcrumbProps) {
  const crumbs = useMemo(
    () => trails.map(trail => trailToCrumb(trail, {location, organization})),
    [location, organization, trails]
  );
  return <StyledBreadcrumbs crumbs={crumbs} />;
}

function trailToCrumb(
  trail: Trail,
  {
    location,
    organization,
  }: {
    location: Location;
    organization: Organization;
  }
): Crumb {
  switch (trail.type) {
    case 'landing': {
      return {
        to: generateProfilingRouteWithQuery({
          location,
          orgSlug: organization.slug,
        }),
        label: t('Profiling'),
        preservePageFilters: true,
      };
    }
    case 'profile summary': {
      return {
        to: generateProfileSummaryRouteWithQuery({
          location,
          orgSlug: organization.slug,
          projectSlug: trail.payload.projectSlug,
          transaction: trail.payload.transaction,
        }),
        label: t('Profile Summary'),
        preservePageFilters: true,
      };
    }
    case 'flamechart': {
      return {
        to: generateProfileFlamechartRouteWithQuery({
          location,
          orgSlug: organization.slug,
          projectSlug: trail.payload.projectSlug,
          profileId: trail.payload.profileId,
        }),
        label: trail.payload.transaction,
        preservePageFilters: true,
      };
    }
    default:
      throw new Error(`Unknown breadcrumb type: ${JSON.stringify(trail)}`);
  }
}

type ProfilingTrail = {
  type: 'landing';
};

type ProfileSummaryTrail = {
  payload: {
    projectSlug: Project['slug'];
    transaction: string;
  };
  type: 'profile summary';
};

type FlamegraphTrail = {
  payload: {
    profileId: string;
    projectSlug: string;
    transaction: string;
  };
  type: 'flamechart';
};

type Trail = ProfilingTrail | ProfileSummaryTrail | FlamegraphTrail;

const StyledBreadcrumbs = styled(Breadcrumbs)`
  padding: 0;
`;

export {Breadcrumb};
