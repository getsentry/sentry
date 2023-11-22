import {useEffect} from 'react';

import ExternalIssueStore from 'sentry/stores/externalIssueStore';
import type {Group, OrganizationSummary, PlatformExternalIssue} from 'sentry/types';
import {useApiQuery} from 'sentry/utils/queryClient';

// We want to do this explicitly so that we can handle errors gracefully,
// instead of the entire component not rendering.
//
// Part of the API request here is fetching data from the Sentry App, so
// we need to be more conservative about error cases since we don't have
// control over those services.
//
export default function useFetchSentryAppData({
  group,
  organization,
}: {
  group: Group;
  organization: OrganizationSummary;
}) {
  const {data} = useApiQuery<PlatformExternalIssue[]>(
    [`/organizations/${organization.slug}/issues/${group.id}/external-issues/`],
    {staleTime: 30_000}
  );

  useEffect(() => {
    if (data) {
      ExternalIssueStore.load(data);
    }
  }, [data]);
}
