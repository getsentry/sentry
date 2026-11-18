import {useQuery} from '@tanstack/react-query';

import type {GroupOpenPeriod} from 'sentry/types/group';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useOrganization} from 'sentry/utils/useOrganization';
import {openPeriodsApiOptions} from 'sentry/views/detectors/hooks/useOpenPeriods';
import {getOpenPeriodIssuePath} from 'sentry/views/detectors/utils/getOpenPeriodIssuePath';
import type {InvestigationSource} from 'sentry/views/investigations/source';

function hasOpeningActivity(openPeriod: GroupOpenPeriod) {
  return openPeriod.activities.some(activity => activity.type === 'opened');
}

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
  const findOpenPeriod = ({json}: {json: GroupOpenPeriod[]}) =>
    json.find(period => period.id === openPeriodId) ?? null;

  // The open periods endpoint has no ID filter, so ask for the periods that
  // overlap the analysis window, which lies inside the investigated one.
  const {data: windowOpenPeriod} = useQuery({
    ...openPeriodsApiOptions({
      organization,
      groupId: groupId ?? '',
      start: analysisWindow?.breachStart,
      end: analysisWindow?.end,
    }),
    enabled: groupId !== null && openPeriodId !== null && analysisWindow !== null,
    select: findOpenPeriod,
  });

  // The endpoint drops activities from before `start`. When the analysis window
  // starts after the open period does, ask again from the period's own start to
  // get the activity that opened it.
  const {data: fullOpenPeriod} = useQuery({
    ...openPeriodsApiOptions({
      organization,
      groupId: groupId ?? '',
      start: windowOpenPeriod?.start,
      end: windowOpenPeriod?.end ?? analysisWindow?.end,
    }),
    enabled: windowOpenPeriod ? !hasOpeningActivity(windowOpenPeriod) : false,
    select: findOpenPeriod,
  });

  if (groupId === null) {
    return null;
  }
  const openPeriod = fullOpenPeriod ?? windowOpenPeriod;
  if (openPeriod) {
    return getOpenPeriodIssuePath(openPeriod, organization.slug);
  }
  return normalizeUrl(`/organizations/${organization.slug}/issues/${groupId}/`);
}
