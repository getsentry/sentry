import Feature from 'sentry/components/acl/feature';
import {Button} from 'sentry/components/button';
import ErrorBoundary from 'sentry/components/errorBoundary';
import KeyValueList from 'sentry/components/events/interfaces/keyValueList';
import {IconProfiling} from 'sentry/icons';
import {t} from 'sentry/locale';
import {Organization} from 'sentry/types';
import {Event, ProfileContext, ProfileContextKey} from 'sentry/types/event';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import {generateProfileFlamechartRoute} from 'sentry/utils/profiling/routes';
import useOrganization from 'sentry/utils/useOrganization';

import {getKnownData, getUnknownData} from '../utils';

const PROFILE_KNOWN_DATA_VALUES = [ProfileContextKey.PROFILE_ID];

interface ProfileContextProps {
  data: ProfileContext & Record<string, any>;
  event: Event;
}

export const ProfileEventContext = ({event, data}: ProfileContextProps) => {
  const organization = useOrganization();
  const meta = event._meta?.contexts?.profile ?? {};

  return (
    <Feature organization={organization} features={['profiling']}>
      <ErrorBoundary mini>
        <KeyValueList
          data={getKnownData<ProfileContext, ProfileContextKey>({
            data,
            meta,
            knownDataTypes: PROFILE_KNOWN_DATA_VALUES,
            onGetKnownDataDetails: v =>
              getProfileKnownDataDetails({...v, organization, event}),
          }).map(v => ({
            ...v,
            subjectDataTestId: `profile-context-${v.key.toLowerCase()}-value`,
          }))}
          shouldSort={false}
          raw={false}
          isContextData
        />

        <KeyValueList
          data={getUnknownData({
            allData: data,
            knownKeys: PROFILE_KNOWN_DATA_VALUES,
            meta,
          })}
          shouldSort={false}
          raw={false}
          isContextData
        />
      </ErrorBoundary>
    </Feature>
  );
};

function getProfileKnownDataDetails({
  data,
  event,
  organization,
  type,
}: {
  data: ProfileContext;
  event: Event;
  organization: Organization;
  type: ProfileContextKey;
}) {
  switch (type) {
    case ProfileContextKey.PROFILE_ID: {
      const profileId = data.profile_id || '';

      if (!profileId) {
        return undefined;
      }

      const target = event.projectSlug
        ? generateProfileFlamechartRoute({
            orgSlug: organization.slug,
            projectSlug: event.projectSlug,
            profileId,
          })
        : undefined;

      return {
        subject: t('Profile ID'),
        value: data.profile_id,
        actionButton: target && (
          <Button
            size="xs"
            to={target}
            onClick={() =>
              trackAdvancedAnalyticsEvent('profiling_views.go_to_flamegraph', {
                organization,
                source: 'events.profile_event_context',
              })
            }
            icon={<IconProfiling size="xs" />}
          >
            {t('Go to Profile')}
          </Button>
        ),
      };
    }
    default:
      return undefined;
  }
}
