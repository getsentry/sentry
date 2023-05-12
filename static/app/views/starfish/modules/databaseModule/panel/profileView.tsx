import {Fragment, useState} from 'react';

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
  const [transactionIdx, setTransactionIdx] = useState<number>(0);

  const result = useQueryGetProfileIds(transactionNames);
  const transactionIds = result?.data?.data?.map(d => d.id) ?? [];
  const eventResult = useQueryGetEvent(transactionIds[transactionIdx]);

  const isLoading = result.isLoading || eventResult.isLoading || eventResult.isRefetching;

  if (isLoading) {
    return <LoadingIndicator />;
  }

  const handleNoProfileFound = () => {
    setTransactionIdx(transactionIdx + 1);
  };

  if (eventResult.data.id && transactionIdx < transactionIds.length) {
    const event = eventResult.data;
    const spans = event.entries[0].data as RawSpanType[];

    const currentSpan = spans.find(s => s.hash === spanHash);
    const profileId = event.contexts?.profile?.profile_id ?? undefined;
    if (currentSpan && profileId) {
      return (
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
                <SpanProfileDetails
                  onNoProfileFound={handleNoProfileFound}
                  event={event}
                  span={currentSpan}
                />
              </ProfileGroupProvider>
            )}
          </ProfileContext.Consumer>
        </ProfilesProvider>
      );
    }
    handleNoProfileFound();
  }

  return <Fragment>'No profile found'</Fragment>;
}

export default ProfileView;
