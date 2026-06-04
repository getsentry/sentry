import {downloadFromHref} from 'sentry/utils/downloadFromHref';

export function downloadObjectAsJson(exportObj: unknown, exportName: string) {
  downloadFromHref(
    `${exportName}.json`,
    `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(exportObj))}`
  );
}
