const WIDGET_LIBRARY_VISITS = 'dashboard-widget-library-visits';

export function shouldShowNewBadge(): boolean {
  const visits = localStorage.getItem(WIDGET_LIBRARY_VISITS);
  return visits === null || (parseInt(visits, 10) || 0) < 5;
}
export function setWidgetLibraryVisit() {
  const visits = localStorage.getItem(WIDGET_LIBRARY_VISITS);
  localStorage.setItem(
    WIDGET_LIBRARY_VISITS,
    visits === null ? '0' : `${(parseInt(visits, 10) || 0) + 1}`
  );
}
