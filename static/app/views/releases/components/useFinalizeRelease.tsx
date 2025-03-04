import type {Release} from 'sentry/types/release';
import {fetchMutation, useMutation} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

type TPayload = {dateReleased: string};
type TData = unknown;
type TError = unknown;
type TVariables = [release: Release];
type TContext = unknown;

export default function useFinalizeRelease() {
  const organization = useOrganization();
  const api = useApi({
    persistInFlight: false,
  });

  return useMutation<TData, TError, TVariables, TContext>({
    mutationFn: ([release]) => {
      // It's likely that there will either be a) CI setup or b) people manually
      // clicking. If people are manually clicking then we try `firstEvent` and
      // fall back to `dateCreated` to preserve relative sort order between
      // releases. This strategy allows users to manually bucket releases by
      // finalized/un-finalized, if they want more precision then CI automation
      // is a better approach.
      const payload: TPayload = {
        dateReleased: release.firstEvent ?? release.dateCreated,
      };

      return fetchMutation(api)([
        'PUT',
        `/organizations/${organization.slug}/releases/${release.version}/`,
        {},
        payload,
      ]);
    },
  });
}
