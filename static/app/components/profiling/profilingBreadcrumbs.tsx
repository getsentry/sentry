import {useMemo} from 'react';
import type {Location} from 'history';
import omit from 'lodash/omit';

import type {Crumb} from 'sentry/components/breadcrumbs';
import _Breadcrumbs from 'sentry/components/breadcrumbs';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils';
import {
  generateProfileFlamechartRouteWithQuery,
  generateProfilingRouteWithQuery,
} from 'sentry/utils/profiling/routes';
import useProjects from 'sentry/utils/useProjects';
import {profilesRouteWithQuery} from 'sentry/views/performance/transactionSummary/transactionProfiles/utils';

export interface ProfilingBreadcrumbsProps {
  organization: Organization;
  trails: Trail[];
}

function ProfilingBreadcrumbs({organization, trails}: ProfilingBreadcrumbsProps) {
  const {projects} = useProjects();
  const crumbs = useMemo(
    () => trails.map(trail => trailToCrumb(trail, {organization, projects})),
    [organization, trails, projects]
  );
  return <_Breadcrumbs crumbs={crumbs} />;
}

function trailToCrumb(
  trail: Trail,
  {
    organization,
    projects,
  }: {
    organization: Organization;
    projects: Project[];
  }
): Crumb {
  switch (trail.type) {
    case 'landing': {
      return {
        to: generateProfilingRouteWithQuery({
          // cursor and query are not used in the landing page
          // and break the API call as the qs gets forwarded to the API
          query: omit(trail.payload.query, ['cursor', 'query']),
          organization,
        }),
        label: t('Profiling'),
        preservePageFilters: true,
      };
    }
    case 'profile summary': {
      const project = projects.find(p => p.slug === trail.payload.projectSlug);
      return {
        to: defined(project)
          ? profilesRouteWithQuery({
              organization,
              transaction: trail.payload.transaction,
              projectID: project.id,
              query: omit(trail.payload.query, ['cursor', 'query']),
            })
          : undefined,
        label: t('Profile Summary'),
        preservePageFilters: true,
      };
    }
    case 'flamechart': {
      return {
        to: generateProfileFlamechartRouteWithQuery({
          query: trail.payload.query,
          organization,
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
