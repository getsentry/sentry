import {useQuery} from '@tanstack/react-query';

import {Text} from '@sentry/scraps/text';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import type {EventsResults} from 'sentry/utils/profiling/hooks/types';
import {useOrganization} from 'sentry/utils/useOrganization';

import {EmbedStory, EmbedVariant} from './embedStory';

type ProfileField = 'profile.id' | 'project.name' | 'timestamp';

/**
 * `has:profile.id` keeps this to transaction-based profiles. A continuous
 * profile is addressed by profiler id plus a time range, which the embed's
 * schema does not carry, so its block would degrade back to a bare link.
 */
const PROFILE_QUERY = 'is_transaction:true has:profile.id';

function asNonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value ? value : undefined;
}

export function ProfileEmbedStory() {
  const organization = useOrganization();
  const {data, isError, isPending} = useQuery(
    apiOptions.as<EventsResults<ProfileField>>()(
      '/organizations/$organizationIdOrSlug/events/',
      {
        path: {organizationIdOrSlug: organization.slug},
        query: {
          dataset: 'spans',
          referrer: 'api.profiling.landing-table',
          project: [-1],
          statsPeriod: '14d',
          field: ['profile.id', 'project.name', 'timestamp'],
          query: PROFILE_QUERY,
          sort: '-timestamp',
          per_page: 1,
        },
        staleTime: 30_000,
      }
    )
  );

  const row = data?.data?.[0];
  const profileId = asNonEmptyString(row?.['profile.id']);
  const projectSlug = asNonEmptyString(row?.['project.name']);

  return (
    <EmbedStory name="profile">
      {isPending ? (
        <LoadingIndicator />
      ) : isError ? (
        <Text variant="muted">Unable to load a profile example.</Text>
      ) : profileId && projectSlug ? (
        <EmbedVariant name="profile" label="Profile" data={{profileId, projectSlug}} />
      ) : (
        <Text variant="muted">No profile is available for this organization.</Text>
      )}
    </EmbedStory>
  );
}
