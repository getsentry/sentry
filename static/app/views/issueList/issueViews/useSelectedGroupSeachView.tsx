import {defined} from 'sentry/utils';
import {getApiQueryData, useQueryClient} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {useFetchGroupSearchView} from 'sentry/views/issueList/queries/useFetchGroupSearchView';
import {makeFetchGroupSearchViewsKey} from 'sentry/views/issueList/queries/useFetchGroupSearchViews';
import type {GroupSearchView} from 'sentry/views/issueList/types';

// Returns the query for the search view that is currently selected according
// to the URL.
export function useSelectedGroupSearchView() {
  const organization = useOrganization();
  const {viewId} = useParams<{viewId?: string}>();
  const queryClient = useQueryClient();

  // The view may have already been loaded by the starred views query,
  // so load that in `initialData` to avoid an unncessary request.
  const queryFromStarredViews = getApiQueryData<GroupSearchView[]>(
    queryClient,
    makeFetchGroupSearchViewsKey({
      orgSlug: organization.slug,
    })
  );
  const matchingView = queryFromStarredViews?.find(v => v.id === viewId);

  return useFetchGroupSearchView(
    {
      id: viewId ?? 0,
      orgSlug: organization.slug,
    },
    {
      enabled: defined(viewId),
      initialData: matchingView ? [matchingView, '200', undefined] : undefined,
    }
  );
}
