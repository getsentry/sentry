import type {Release} from 'sentry/types/release';
import {fetchMutation, useMutation} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

export default function useFinalizeRelease() {
  const organization = useOrganization();

  return useMutation({
    mutationFn: ([release]: [release: Release]) => {
      // It's likely that there will either be a) CI setup or b) people manually
      // clicking. If people are manually clicking then we try `firstEvent` and
      // fall back to `dateCreated` to preserve relative sort order between
      // releases. This strategy allows users to manually bucket releases by
      // finalized/un-finalized, if they want more precision then CI automation
      // is a better approach.
      const payload = {
        dateReleased: release.firstEvent ?? release.dateCreated,
      };

      return fetchMutation([
        'PUT',
        `/organizations/${organization.slug}/releases/${release.version}/`,
        {},
        payload,
      ]);
    },
  });
}
