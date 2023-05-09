import {SpanProfileDetails} from 'sentry/components/events/interfaces/spans/spanProfileDetails';
import {RawSpanType} from 'sentry/components/events/interfaces/spans/types';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import useOrganization from 'sentry/utils/useOrganization';
import {ProfileGroupProvider} from 'sentry/views/profiling/profileGroupProvider';
import {ProfileContext, ProfilesProvider} from 'sentry/views/profiling/profilesProvider';
import {
  useQueryGetEvent,
  useQueryGetProfileIds,
} from 'sentry/views/starfish/modules/databaseModule/queries';

type Props = {
  spanHash: string;
  transactionNames: string[];
};

export function ProfileView(props: Props) {
  const {spanHash, transactionNames} = props;
  const organization = useOrganization();

  const result = useQueryGetProfileIds(transactionNames, spanHash);
  const eventResult = useQueryGetEvent(result.data[0]?.transaction_id);

  const isLoading = result.isLoading || eventResult.isLoading;

  if (isLoading) {
    return <LoadingIndicator />;
  }

  let profileView: React.ReactNode = 'No profile found';

  if (eventResult.data.id) {
    const event = eventResult.data;
    const spans = event.entries[0].data as RawSpanType[];

    const currentSpan = spans.find(s => s.hash === spanHash);
    const profileId = event.contexts?.profile?.profile_id ?? undefined;
    if (currentSpan && profileId) {
      profileView = (
        <ProfilesProvider
          orgSlug={organization.slug}
          profileId={profileId}
          projectSlug="sentry" // TODO - don't harcode this
        >
          <ProfileContext.Consumer>
            {profiles => (
              <ProfileGroupProvider
                type="flamechart"
                input={profiles?.type === 'resolved' ? profiles.data : null}
                traceID={profileId || ''}
              >
                <SpanProfileDetails event={event} span={currentSpan} />
              </ProfileGroupProvider>
            )}
          </ProfileContext.Consumer>
        </ProfilesProvider>
      );
    }
  }

  return profileView;
}

export default ProfileView;
