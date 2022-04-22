import {useMemo} from 'react';
import styled from '@emotion/styled';

import Breadcrumbs, {Crumb} from 'sentry/components/breadcrumbs';
import {t} from 'sentry/locale';
import {Organization} from 'sentry/types';
import useOrganization from 'sentry/utils/useOrganization';
import {
  generateFlamegraphRoute,
  generateProfilingRoute,
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
  trails: Trail[];
}

function Breadcrumb({trails}: BreadcrumbProps) {
  const organization = useOrganization();
  const crumbs = useMemo(
    () => trails.map(trail => trailToCrumb(trail, {organization})),
    [trails]
  );
  return <StyledBreadcrumbs crumbs={crumbs} />;
}

function trailToCrumb(trail: Trail, {organization}: {organization: Organization}): Crumb {
  const trailType = trail.type;
  switch (trailType) {
    case 'profiling': {
      return {
        to: generateProfilingRoute({orgSlug: organization.slug}),
        label: t('Profiling'),
        preservePageFilters: true,
      };
    }
    case 'flamegraph': {
      return {
        to: generateFlamegraphRoute({
          orgSlug: organization.slug,
          projectSlug: trail.payload.projectSlug,
          profileId: trail.payload.profileId,
        }),
        label: trail.payload.interactionName,
        preservePageFilters: true,
      };
    }
    default:
      throw new Error(`Unknown breadcrumb type: ${trailType}`);
  }
}

const StyledBreadcrumbs = styled(Breadcrumbs)`
  padding: 0;
`;

export {Breadcrumb};
