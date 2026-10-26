import type {DashboardListItem} from 'sentry/views/dashboards/types';

function favoritesFirstThenRecentlyViewed(
  a: DashboardListItem,
  b: DashboardListItem
): number {
  const favoriteDiff = Number(Boolean(b.isFavorited)) - Number(Boolean(a.isFavorited));
  if (favoriteDiff !== 0) {
    return favoriteDiff;
  }

  const aVisited = a.lastVisited;
  const bVisited = b.lastVisited;
  if (aVisited && bVisited) {
    const visitedDiff = bVisited.localeCompare(aVisited);
    if (visitedDiff !== 0) {
      return visitedDiff;
    }
  } else if (aVisited) {
    return -1;
  } else if (bVisited) {
    return 1;
  }

  return Number(b.id) - Number(a.id);
}

/**
 * Optimistically reorders the pinned dashboards list after a favorite toggle.
 * Currently positioning item based on default sort (`recentlyReviewed`), rather
 * than the currently selected sort. This is in an effort to decrease potentially
 * unnecessary complexity.
 */
export function reorderFavoriteDashboards(
  list: DashboardListItem[],
  dashboardId: string,
  shouldFavorite: boolean
): DashboardListItem[] {
  return list
    .map(dashboard =>
      dashboard.id === dashboardId
        ? {...dashboard, isFavorited: shouldFavorite}
        : dashboard
    )
    .sort(favoritesFirstThenRecentlyViewed);
}
