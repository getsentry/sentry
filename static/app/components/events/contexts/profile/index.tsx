import Feature from 'sentry/components/acl/feature';
import {Button} from 'sentry/components/button';
import ErrorBoundary from 'sentry/components/errorBoundary';
import KeyValueList from 'sentry/components/events/interfaces/keyValueList';
import {t} from 'sentry/locale';
import {Organization, Project} from 'sentry/types';
import {Event, ProfileContext, ProfileContextKey} from 'sentry/types/event';
import {trackAnalytics} from 'sentry/utils/analytics';
import {generateProfileFlamechartRoute} from 'sentry/utils/profiling/routes';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';

import {getKnownData, getUnknownData} from '../utils';

const PROFILE_KNOWN_DATA_VALUES = [ProfileContextKey.PROFILE_ID];

interface ProfileContextProps {
  data: ProfileContext & Record<string, any>;
  event: Event;
}

export function ProfileEventContext({event, data}: ProfileContextProps) {
  const organization = useOrganization();
  const {projects} = useProjects();
  const project = projects.find(p => p.id === event.projectID);
  const meta = event._meta?.contexts?.profile ?? {};

  return (
    <Feature organization={organization} features="profiling">
      <ErrorBoundary mini>
        <KeyValueList
          data={getKnownData<ProfileContext, ProfileContextKey>({
            data,
            meta,
            knownDataTypes: PROFILE_KNOWN_DATA_VALUES,
            onGetKnownDataDetails: v =>
              getProfileKnownDataDetails({...v, organization, project}),
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
}

function getProfileKnownDataDetails({
  data,
  organization,
  project,
  type,
}: {
  data: ProfileContext;
  organization: Organization;
  type: ProfileContextKey;
  project?: Project;
}) {
  switch (type) {
    case ProfileContextKey.PROFILE_ID: {
      const profileId = data.profile_id || '';

      if (!profileId) {
        return undefined;
      }

      const target = project?.slug
        ? generateProfileFlamechartRoute({
            orgSlug: organization.slug,
            projectSlug: project?.slug,
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
              trackAnalytics('profiling_views.go_to_flamegraph', {
                organization,
                source: 'events.profile_event_context',
              })
            }
          >
            {t('View Profile')}
          </Button>
        ),
      };
    }
    default:
      return undefined;
  }
}
