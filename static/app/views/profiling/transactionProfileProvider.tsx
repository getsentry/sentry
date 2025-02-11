import {useState} from 'react';

import {ProfileHeader} from 'sentry/components/profiling/profileHeader';
import type {RequestState} from 'sentry/types/core';
import type {EventTransaction} from 'sentry/types/event';
import {isSchema, isSentrySampledProfile} from 'sentry/utils/profiling/guards/profile';
import {useSentryEvent} from 'sentry/utils/profiling/hooks/useSentryEvent';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';

import {ProfileTransactionContext, TransactionProfileProvider} from './profilesProvider';

function getTransactionId(input: Profiling.ProfileInput): string | null {
  if (isSchema(input)) {
    return input.metadata.transactionID;
  }
  if (isSentrySampledProfile(input)) {
    return input.transaction.id;
  }
  return null;
}

interface FlamegraphViewProps {
  children: React.ReactNode;
}

export default function ProfileAndTransactionProvider(
  props: FlamegraphViewProps
): React.ReactElement {
  const organization = useOrganization();
  const params = useParams();

  const projectSlug = params.projectId!;

  const [profile, setProfile] = useState<RequestState<Profiling.ProfileInput>>({
    type: 'initial',
  });

  const profileTransaction = useSentryEvent<EventTransaction>(
    organization.slug,
    projectSlug,
    profile.type === 'resolved' ? getTransactionId(profile.data) : null
  );

  return (
    <TransactionProfileProvider
      orgSlug={organization.slug}
      profileId={params.eventId!}
      projectSlug={projectSlug}
      profile={profile}
      setProfile={setProfile}
    >
      <ProfileTransactionContext.Provider value={profileTransaction}>
        <ProfileHeader
          eventId={params.eventId!}
          projectId={projectSlug}
          transaction={
            profileTransaction.type === 'resolved' ? profileTransaction.data : null
          }
        />
        {props.children}
      </ProfileTransactionContext.Provider>
    </TransactionProfileProvider>
  );
}
