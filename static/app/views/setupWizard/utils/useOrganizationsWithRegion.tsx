import * as Sentry from '@sentry/react';
import {useQuery} from '@tanstack/react-query';

import {ConfigStore} from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import type {OrganizationSummary} from 'sentry/types/organization';
import type {Locality} from 'sentry/types/system';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getLocalities} from 'sentry/utils/cells';
import type {OrganizationSummaryWithLocality} from 'sentry/views/setupWizard/types';

export function useOrganizationsWithRegion() {
  const localities = getLocalities();
  const localitiesByUrl = localities.reduce<Record<string, Locality>>((acc, l) => {
    acc[l.url] = l;
    return acc;
  }, {});
  const {links} = useLegacyStore(ConfigStore);

  const query = useQuery({
    ...apiOptions.as<OrganizationSummary[]>()('/organizations/', {
      host: links.sentryUrl, // request from control silo
      staleTime: 0,
    }),
    refetchOnWindowFocus: false,
    retry: false,
    select: response => {
      return response.json.flatMap((org): OrganizationSummaryWithLocality[] => {
        const locality = localitiesByUrl[org.links.regionUrl];
        if (!locality) {
          // This is not expected to happen, but log it so we can diagnose if
          // an organization's locality is missing from the known localities.
          Sentry.captureMessage('Could not match organization region URL to a locality', {
            level: 'warning',
            extra: {
              organizationSlug: org.slug,
              regionUrl: org.links.regionUrl,
            },
          });
          return [];
        }
        return [{...org, region: locality} as OrganizationSummaryWithLocality];
      });
    },
  });

  return {
    data: query.data ?? [],
    isError: query.isError,
    isPending: query.isPending,
  };
}
