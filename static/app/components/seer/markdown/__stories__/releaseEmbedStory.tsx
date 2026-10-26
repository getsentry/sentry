import {useQuery} from '@tanstack/react-query';

import {Text} from '@sentry/scraps/text';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import type {Release} from 'sentry/types/release';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';

import {EmbedStory, EmbedVariant} from './embedStory';

export function ReleaseEmbedStory() {
  const organization = useOrganization();
  const {data, isError, isPending} = useQuery(
    apiOptions.as<Release[]>()('/organizations/$organizationIdOrSlug/releases/', {
      path: {organizationIdOrSlug: organization.slug},
      query: {per_page: 1},
      staleTime: 30_000,
    })
  );
  const release = data?.[0];

  return (
    <EmbedStory name="release">
      {isPending ? (
        <LoadingIndicator />
      ) : isError ? (
        <Text variant="muted">Unable to load a release example.</Text>
      ) : release ? (
        <EmbedVariant
          name="release"
          label="Release"
          data={{
            version: release.version,
            projectId:
              release.projects.length === 1 ? release.projects.at(0)?.id : undefined,
          }}
        />
      ) : (
        <Text variant="muted">No release is available for this organization.</Text>
      )}
    </EmbedStory>
  );
}
