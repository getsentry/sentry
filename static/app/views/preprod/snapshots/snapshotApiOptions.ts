import {skipToken} from '@tanstack/react-query';

import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import type {SnapshotDetailsApiResponse} from 'sentry/views/preprod/types/snapshotTypes';

export const useSnapShotApiOptions = () => {
  const organization = useOrganization();
  const {snapshotId} = useParams<{
    snapshotId: string;
  }>();

  return apiOptions.as<SnapshotDetailsApiResponse>()(
    '/organizations/$organizationIdOrSlug/preprodartifacts/snapshots/$snapshotId/',
    {
      path: snapshotId
        ? {
            organizationIdOrSlug: organization.slug,
            snapshotId,
          }
        : skipToken,
      staleTime: 0,
    }
  );
};
