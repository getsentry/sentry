import {useQuery} from '@tanstack/react-query';

import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {UptimeRule} from 'sentry/views/detectors/components/uptime/types';

interface UseUptimeRuleOptions {
  detectorId: string;
  projectSlug: string;
}

export function useUptimeRule({projectSlug, detectorId}: UseUptimeRuleOptions) {
  const organization = useOrganization();

  const options = apiOptions.as<UptimeRule>()(
    '/projects/$organizationIdOrSlug/$projectIdOrSlug/uptime/$uptimeDetectorId/',
    {
      staleTime: 0,
      path: {
        organizationIdOrSlug: organization.slug,
        projectIdOrSlug: projectSlug,
        uptimeDetectorId: detectorId,
      },
    }
  );
  return useQuery(options);
}
