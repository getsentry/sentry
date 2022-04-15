// Widget Viewer specific query params so we don't interfere with other params like GSH
export enum WidgetViewerQueryField {
  SORT = 'sort',
  QUERY = 'query',
  LEGEND = 'legend',
  PAGE = 'page',
  CURSOR = 'cursor',
  WIDTH = 'width',
  START = 'viewerStart',
  END = 'viewerEnd',
}

export function isWidgetViewerPath(pathname: string) {
  return pathname.match(/\/widget\/[0-9]+\/$/);
}
