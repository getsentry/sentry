// Widget Viewer specific query params so we don't interfere with other params like GSH
export enum WidgetViewerQueryField {
  SORT = 'modalSort',
  QUERY = 'query',
}

export function isWidgetViewerPath(pathname: string) {
  return pathname.match(/\/widget\/[0-9]+\/$/);
}
