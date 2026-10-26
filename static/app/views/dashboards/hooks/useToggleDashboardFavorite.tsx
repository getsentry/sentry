import {useMutation, useQueryClient, type Query} from '@tanstack/react-query';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import type {ApiResponse} from 'sentry/utils/api/apiFetch';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {dashboardsApiOptions} from 'sentry/utils/dashboards/dashboardsApiOptions';
import {fetchMutation} from 'sentry/utils/queryClient';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {useOrganization} from 'sentry/utils/useOrganization';
import {getStarredDashboardsQueryKey} from 'sentry/views/dashboards/hooks/useGetStarredDashboards';
import {reorderFavoriteDashboards} from 'sentry/views/dashboards/manage/utils/reorderFavoriteDashboards';
import type {DashboardListItem} from 'sentry/views/dashboards/types';
import {flattenErrors} from 'sentry/views/dashboards/utils';

type ToggleFavoriteVariables = {
  dashboard: DashboardListItem;
  shouldFavorite: boolean;
};

/**
 * Toggles a dashboard's favorite status and optimistically sorts both the
 * dashboard table and the "Starred Dashboards" sidebar in the same tick.
 */
export function useToggleDashboardFavorite() {
  const organization = useOrganization();
  const queryClient = useQueryClient();

  const hasUserLastVisited = organization.features.includes(
    'dashboards-user-last-visited'
  );

  // Table query key for dashboards pinned by favorites.
  const listFilter = {
    queryKey: [dashboardsApiOptions(organization).queryKey[0]],
    predicate: (query: Query) => {
      const options = query.queryKey[1] as {query?: {pin?: string}} | undefined;
      return options?.query?.pin === 'favorites';
    },
  };
  // Query key for the "Starred Dashboards" sidebar.
  const starredQueryKey = getStarredDashboardsQueryKey(organization);

  const {mutate} = useMutation({
    mutationFn: ({dashboard, shouldFavorite}: ToggleFavoriteVariables) =>
      fetchMutation({
        url: getApiUrl(
          '/organizations/$organizationIdOrSlug/dashboards/$dashboardId/favorite/',
          {path: {organizationIdOrSlug: organization.slug, dashboardId: dashboard.id}}
        ),
        method: 'PUT',
        data: {shouldFavorite},
      }),

    onMutate: async ({dashboard, shouldFavorite}) => {
      const dashboardId = dashboard.id;
      await Promise.all([
        queryClient.cancelQueries(listFilter),
        queryClient.cancelQueries({queryKey: starredQueryKey}),
      ]);

      // Optimistically re-sort the manage table.
      const tableSnapshot = queryClient.getQueriesData(listFilter);
      tableSnapshot.forEach(([key, data]) => {
        const response = data as ApiResponse<DashboardListItem[]> | undefined;
        if (!response) {
          return;
        }
        const options = key[1] as {query?: {sort?: string}} | undefined;
        const json =
          options?.query?.sort === 'recentlyViewed' && hasUserLastVisited
            ? reorderFavoriteDashboards(response.json, dashboardId, shouldFavorite)
            : response.json.map(item =>
                item.id === dashboardId ? {...item, isFavorited: shouldFavorite} : item
              );
        queryClient.setQueryData(key, {...response, json});
      });

      // Optimistically update the sidebar's starred list.
      const starredSnapshot = queryClient.getQueryData(starredQueryKey);
      queryClient.setQueryData(starredQueryKey, prev => {
        if (!prev) {
          return prev;
        }
        const withoutCurrent = prev.json.filter(item => item.id !== dashboardId);
        const json = shouldFavorite
          ? [...withoutCurrent, {...dashboard, isFavorited: true}]
          : withoutCurrent;
        return {...prev, json};
      });

      return {tableSnapshot, starredSnapshot};
    },

    onError: (error, {shouldFavorite}, context) => {
      context?.tableSnapshot.forEach(([key, data]) =>
        queryClient.setQueryData(key, data)
      );
      queryClient.setQueryData(starredQueryKey, context?.starredSnapshot);

      const errorResponse = error instanceof RequestError ? error.responseJSON : null;
      if (errorResponse) {
        const errors = flattenErrors(errorResponse, {});
        addErrorMessage(errors[Object.keys(errors)[0]!]! as string);
      } else {
        addErrorMessage(
          shouldFavorite
            ? t('Unable to favorite dashboard')
            : t('Unable to unfavorite dashboard')
        );
      }
    },

    onSuccess: (_data, {dashboard, shouldFavorite}) => {
      addSuccessMessage(
        shouldFavorite ? t('Added as favorite') : t('Removed as favorite')
      );
      trackAnalytics('dashboards_manage.toggle_favorite', {
        organization,
        dashboard_id: dashboard.id,
        favorited: shouldFavorite,
      });
    },

    onSettled: () => {
      queryClient.invalidateQueries(dashboardsApiOptions(organization));
      queryClient.invalidateQueries({queryKey: starredQueryKey});
    },
  });

  return mutate;
}
