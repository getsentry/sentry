import {useMemo} from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import Breadcrumbs, {Crumb} from 'sentry/components/breadcrumbs';
import {t} from 'sentry/locale';
import {Organization} from 'sentry/types';
import {
  flamegraphRouteWithQuery,
  profilingRouteWithQuery,
} from 'sentry/views/profiling/routes';

type ProfilingTrail = {
  type: 'profiling';
};

type FlamegraphTrail = {
  payload: {
    interactionName: string;
    profileId: string;
    projectSlug: string;
  };
  type: 'flamegraph';
};

type Trail = ProfilingTrail | FlamegraphTrail;

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
    case 'profiling': {
      return {
        to: profilingRouteWithQuery({
          location,
          orgSlug: organization.slug,
        }),
        label: t('Profiling'),
        preservePageFilters: true,
      };
    }
    case 'flamegraph': {
      return {
        to: flamegraphRouteWithQuery({
          location,
          orgSlug: organization.slug,
          projectSlug: trail.payload.projectSlug,
          profileId: trail.payload.profileId,
        }),
        label: trail.payload.interactionName,
        preservePageFilters: true,
      };
    }
    default:
      throw new Error(`Unknown breadcrumb type: ${JSON.stringify(trail)}`);
  }
}

const StyledBreadcrumbs = styled(Breadcrumbs)`
  padding: 0;
`;

export {Breadcrumb};
