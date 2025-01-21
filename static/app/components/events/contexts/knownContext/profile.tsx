import {getContextKeys} from 'sentry/components/events/contexts/utils';
import {t} from 'sentry/locale';
import type {Event, EventTransaction, ProfileContext} from 'sentry/types/event';
import {EventOrGroupType, ProfileContextKey} from 'sentry/types/event';
import type {KeyValueListData} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils';
import {getDateFromTimestamp} from 'sentry/utils/dates';
import {
  generateContinuousProfileFlamechartRouteWithQuery,
  generateProfileFlamechartRoute,
} from 'sentry/utils/profiling/routes';

export function getProfileContextData({
  data,
  event,
  organization,
  project,
  meta,
}: {
  data: ProfileContext;
  event: Event;
  organization: Organization;
  meta?: Record<keyof ProfileContext, any>;
  project?: Project;
}): KeyValueListData {
  return getContextKeys({data})
    .map(ctxKey => {
      switch (ctxKey) {
        case ProfileContextKey.PROFILE_ID:
          return getProfileIdEntry(data, organization, project);
        case ProfileContextKey.PROFILER_ID:
          return getProfilerIdEntry(data, event, organization, project);
        default:
          return {
            key: ctxKey,
            subject: ctxKey,
            // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
            value: data[ctxKey],
            // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
            meta: meta?.[ctxKey]?.[''],
          };
      }
    })
    .filter(defined);
}

function getProfileIdEntry(
  data: ProfileContext,
  organization: Organization,
  project?: Project
) {
  const profileId = data.profile_id || '';
  if (!profileId) {
    return undefined;
  }
  const link = project?.slug
    ? generateProfileFlamechartRoute({
        orgSlug: organization.slug,
        projectSlug: project.slug,
        profileId,
      })
    : undefined;
  return {
    key: ProfileContextKey.PROFILE_ID,
    subject: t('Profile ID'),
    value: data.profile_id,
    action: {link},
  };
}

function getProfilerIdEntry(
  data: ProfileContext,
  event: Event,
  organization: Organization,
  project?: Project
) {
  const profilerId = data.profiler_id || '';
  if (!profilerId) {
    return undefined;
  }
  const [start, end] = getStartEnd(event);
  const link =
    project?.slug && start && end
      ? generateContinuousProfileFlamechartRouteWithQuery({
          orgSlug: organization.slug,
          projectSlug: project.slug,
          profilerId,
          start,
          end,
          query: {
            eventId: event.id,
          },
        })
      : undefined;
  return {
    key: ProfileContextKey.PROFILER_ID,
    subject: t('Profiler ID'),
    value: data.profiler_id,
    action: {link},
  };
}

function getStartEnd(event: any): [string | null, string | null] {
  if (!isTransaction(event)) {
    return [null, null];
  }

  const start = getDateFromTimestamp(event.startTimestamp * 1000);
  const end = getDateFromTimestamp(event.endTimestamp * 1000);

  if (!start || !end) {
    return [null, null];
  }

  return [start.toISOString(), end.toISOString()];
}

function isTransaction(event: Event): event is EventTransaction {
  return event.type === EventOrGroupType.TRANSACTION;
}
