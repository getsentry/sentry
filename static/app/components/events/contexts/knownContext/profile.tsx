import {getContextKeys} from 'sentry/components/events/contexts/utils';
import {t} from 'sentry/locale';
import {type ProfileContext, ProfileContextKey} from 'sentry/types/event';
import type {KeyValueListData} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils';
import {generateProfileFlamechartRoute} from 'sentry/utils/profiling/routes';

export function getProfileContextData({
  data,
  organization,
  project,
  meta,
}: {
  data: ProfileContext;
  organization: Organization;
  meta?: Record<keyof ProfileContext, any>;
  project?: Project;
}): KeyValueListData {
  return getContextKeys({data})
    .map(ctxKey => {
      switch (ctxKey) {
        case ProfileContextKey.PROFILE_ID:
          const profileId = data.profile_id || '';
          if (!profileId) {
            return undefined;
          }
          const link = project?.slug
            ? generateProfileFlamechartRoute({
                orgSlug: organization.slug,
                projectSlug: project?.slug,
                profileId,
              })
            : undefined;
          return {
            key: ctxKey,
            subject: t('Profile ID'),
            value: data.profile_id,
            action: {link},
          };
        default:
          return {
            key: ctxKey,
            subject: ctxKey,
            value: data[ctxKey],
            meta: meta?.[ctxKey]?.[''],
          };
      }
    })
    .filter(defined);
}
