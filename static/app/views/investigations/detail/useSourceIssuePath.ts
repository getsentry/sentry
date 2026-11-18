import {useQuery} from '@tanstack/react-query';

import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useOrganization} from 'sentry/utils/useOrganization';
import {openPeriodsApiOptions} from 'sentry/views/detectors/hooks/useOpenPeriods';
import {getOpenPeriodIssuePath} from 'sentry/views/detectors/utils/getOpenPeriodIssuePath';
import type {InvestigationSource} from 'sentry/views/investigations/source';

/**
 * Links to the event that opened the investigated open period, so the issue
 * shows that period instead of the latest one. Falls back to the issue itself
 * until the open period loads, or when it can't be found.
 */
export function useSourceIssuePath({
  groupId,
  openPeriodId,
  analysisWindow,
}: InvestigationSource): string | null {
  const organization = useOrganization();

  // The open periods endpoint has no ID filter, so ask for the periods that
  // overlap the analysis window, which lies inside the investigated one.
  const {data: openPeriod} = useQuery({
    ...openPeriodsApiOptions({
      organization,
      groupId: groupId ?? '',
      start: analysisWindow?.breachStart,
      end: analysisWindow?.end,
    }),
    enabled: groupId !== null && openPeriodId !== null && analysisWindow !== null,
    select: ({json}) => json.find(period => period.id === openPeriodId) ?? null,
  });

  if (groupId === null) {
    return null;
  }
  if (openPeriod) {
    return getOpenPeriodIssuePath(openPeriod, organization.slug);
  }
  return normalizeUrl(`/organizations/${organization.slug}/issues/${groupId}/`);
}
