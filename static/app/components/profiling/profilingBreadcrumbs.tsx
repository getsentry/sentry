import {useMemo} from 'react';
import {Location} from 'history';
import omit from 'lodash/omit';

import _Breadcrumbs, {Crumb} from 'sentry/components/breadcrumbs';
import {t} from 'sentry/locale';
import {Organization, Project} from 'sentry/types';
import {
  generateProfileFlamechartRouteWithQuery,
  generateProfileSummaryRouteWithQuery,
  generateProfilingRouteWithQuery,
} from 'sentry/utils/profiling/routes';

export interface ProfilingBreadcrumbsProps {
  organization: Organization;
  trails: Trail[];
}

function ProfilingBreadcrumbs({organization, trails}: ProfilingBreadcrumbsProps) {
  const crumbs = useMemo(
    () => trails.map(trail => trailToCrumb(trail, {organization})),
    [organization, trails]
  );
  return <_Breadcrumbs crumbs={crumbs} />;
}

function trailToCrumb(
  trail: Trail,
  {
    organization,
  }: {
    organization: Organization;
  }
): Crumb {
  switch (trail.type) {
    case 'landing': {
      return {
        to: generateProfilingRouteWithQuery({
          // cursor and query are not used in the landing page
          // and break the API call as the qs gets forwarded to the API
          query: omit(trail.payload.query, ['cursor', 'query']),
          orgSlug: organization.slug,
        }),
        label: t('Profiling'),
        preservePageFilters: true,
      };
    }
    case 'profile summary': {
      return {
        to: generateProfileSummaryRouteWithQuery({
          // cursor and query are not used in the summary page
          // and break the API call as the qs gets forwarded to the API
          query: omit(trail.payload.query, ['cursor', 'query']),
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
          query: trail.payload.query,
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
  payload: {
    query: Location['query'];
  };
  type: 'landing';
};

type ProfileSummaryTrail = {
  payload: {
    projectSlug: Project['slug'];
    query: Location['query'];
    transaction: string;
  };
  type: 'profile summary';
};

type FlamegraphTrail = {
  payload: {
    profileId: string;
    projectSlug: string;
    query: Location['query'];
    transaction: string;
  };
  type: 'flamechart';
};

type Trail = ProfilingTrail | ProfileSummaryTrail | FlamegraphTrail;

export {ProfilingBreadcrumbs};
