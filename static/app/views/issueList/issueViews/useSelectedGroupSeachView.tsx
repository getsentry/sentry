import {defined} from 'sentry/utils';
import {getApiQueryData, useQueryClient} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {useFetchGroupSearchView} from 'sentry/views/issueList/queries/useFetchGroupSearchView';
import {makeFetchStarredGroupSearchViewsKey} from 'sentry/views/issueList/queries/useFetchStarredGroupSearchViews';
import {
  GroupSearchViewVisibility,
  type StarredGroupSearchView,
} from 'sentry/views/issueList/types';

// Returns the query for the search view that is currently selected according
// to the URL.
export function useSelectedGroupSearchView() {
  const organization = useOrganization();
  const {viewId} = useParams<{viewId?: string}>();
  const queryClient = useQueryClient();

  // The view may have already been loaded by the starred views query,
  // so load that in `initialData` to avoid an unncessary request.
  const queryFromStarredViews = getApiQueryData<StarredGroupSearchView[]>(
    queryClient,
    makeFetchStarredGroupSearchViewsKey({
      orgSlug: organization.slug,
    })
  );
  const matchingView = queryFromStarredViews
    // XXX (malwilley): Issue views without the nav require at least one issue view,
    // so they respond with "fake" issue views that do not have an ID.
    // We should remove this from the backend and here once we remove the tab-based views.
    ?.filter(view => defined(view.id))
    ?.find(v => v.id === viewId);

  return useFetchGroupSearchView(
    {
      id: viewId ?? 0,
      orgSlug: organization.slug,
    },
    {
      enabled: defined(viewId),
      initialData: matchingView
        ? [
            {
              ...matchingView,
              starred: true,
              visibility: GroupSearchViewVisibility.ORGANIZATION,
            },
            '200',
            undefined,
          ]
        : undefined,
      retry: false,
    }
  );
}
