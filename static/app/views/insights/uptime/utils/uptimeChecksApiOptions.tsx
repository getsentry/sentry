import {queryOptions} from '@tanstack/react-query';

import {apiOptions} from 'sentry/utils/api/apiOptions';
import type {UptimeCheck} from 'sentry/views/alerts/rules/uptime/types';

interface UptimeChecksParameters {
  detectorId: string;
  orgSlug: string;
  projectSlug: string;
  cursor?: string;
  end?: string;
  limit?: number;
  start?: string;
  statsPeriod?: string;
}

export function uptimeChecksApiOptions({
  orgSlug,
  projectSlug,
  detectorId,
  cursor,
  limit,
  start,
  end,
  statsPeriod,
}: UptimeChecksParameters) {
  // TODO(Leander): Add querying and sorting, when the endpoint supports it
  return queryOptions({
    ...apiOptions.as<UptimeCheck[]>()(
      '/projects/$organizationIdOrSlug/$projectIdOrSlug/uptime/$uptimeDetectorId/checks/',
      {
        path: {
          organizationIdOrSlug: orgSlug,
          projectIdOrSlug: projectSlug,
          uptimeDetectorId: detectorId,
        },
        query: {
          per_page: limit,
          cursor,
          start,
          end,
          statsPeriod,
        },
        staleTime: 10_000,
      }
    ),
    retry: true,
  });
}
