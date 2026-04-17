import {useQueryClient} from '@tanstack/react-query';
import {useQuery} from '@tanstack/react-query';

import {defined} from 'sentry/utils';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {groupSearchViewApiOptions} from 'sentry/views/issueList/queries/groupSearchView';
import {starredGroupSearchViewsApiOptions} from 'sentry/views/issueList/queries/starredGroupSearchViews';
import {GroupSearchViewVisibility} from 'sentry/views/issueList/types';

// Returns the query for the search view that is currently selected according
// to the URL.
export function useSelectedGroupSearchView() {
  const organization = useOrganization();
  const {viewId} = useParams<{viewId?: string}>();
  const queryClient = useQueryClient();

  return useQuery({
    ...groupSearchViewApiOptions({
      id: viewId ?? 0,
      orgSlug: organization.slug,
    }),
    enabled: defined(viewId),
    initialData: () => {
      // The view may have already been loaded by the starred views query,
      // so load that in `initialData` to avoid an unnecessary request.
      const queryFromStarredViews = queryClient.getQueryData(
        starredGroupSearchViewsApiOptions({orgSlug: organization.slug}).queryKey
      )?.json;
      const matchingView = queryFromStarredViews
        // XXX (malwilley): Issue views without the nav require at least one issue view,
        // so they respond with "fake" issue views that do not have an ID.
        // We should remove this from the backend and here once we remove the tab-based views.
        ?.filter(view => defined(view.id))
        ?.find(v => v.id === viewId);

      return matchingView
        ? {
            json: {
              ...matchingView,
              starred: true,
              visibility: GroupSearchViewVisibility.ORGANIZATION,
            },
            headers: {},
          }
        : undefined;
    },
  });
}
